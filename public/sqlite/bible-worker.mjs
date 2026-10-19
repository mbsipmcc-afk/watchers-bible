/**
 * The Bible database worker.
 *
 * Runs SQLite WASM off the main thread so a heavy FTS query or a 10 MB corpus
 * import never janks the reader. The database is persisted in OPFS via the
 * SAH-pool VFS when the browser exposes it (persists across reloads, so a
 * translation is downloaded once), and in memory otherwise.
 *
 * Same message protocol and self-heal contract as the Anywhere Worship
 * corpora worker, with two changes:
 *   - persistence uses `installOpfsSAHPoolVfs()` (no COOP/COEP headers needed)
 *   - `{type:"import"}` lets the UI feed pre-downloaded corpus bytes straight
 *     into OPFS (real download progress), and `{type:"persisted"}` /
 *     `{type:"delete"}` back the translation manager.
 *
 * Message protocol (main -> worker):
 *   { type: "open",     id, expectedVerses?, avoidOpfs? }
 *   { type: "import",   id, bytes, expectedVerses?, avoidOpfs? }
 *   { type: "chapter",  id, bookNr, chapter, verse, expectedVerses? }
 *   { type: "search",   id, query, limit, offset, expectedVerses? }
 *   { type: "concordance", id, word, limit, expectedVerses? }
 *   { type: "persisted" }
 *   { type: "delete",   id }
 *   { type: "close",    id }
 *   { type: "resetOpfs", id }   unlink the persisted copy ("*" wipes all)
 * (worker -> main): { type: "ready" | "rows" | "error", ... }
 *
 * Error codes: worker_spawn | wasm_load | corpus_fetch | opfs_unavailable |
 * db_corrupt | fts_missing | count_mismatch | query_failed | unknown
 *
 * The open contract: a persisted OPFS copy is only reused when it is
 * verifiably the SAME schema and edition (quick check passes, the FTS table
 * exists AND is fully populated, and the verse count matches
 * `expectedVerses` when given). Anything else is silently wiped and
 * re-imported from the pristine network corpus.
 */
let sqlite3 = null;
let db = null;
let currentId = null;
let avoidOpfs = false;
let pool = null;
let lastOpenPersisted = false; // was the current handle opened from OPFS?

const POOL_PATHS = (id) => `/bible-${id}.sqlite3`;

async function getSqlite() {
  if (sqlite3) return sqlite3;
  // The module resolves its .wasm relative to itself; both live in /sqlite/.
  const mod = await import("/sqlite/sqlite3.mjs").catch((e) => {
    const err = new Error(`SQLite engine failed to load: ${e?.message || e}`);
    err.code = "wasm_load";
    throw err;
  });
  try {
    sqlite3 = await mod.default({
      locateFile: (file) => `/sqlite/${file}`,
    });
  } catch (e) {
    const err = new Error(`SQLite engine failed to start: ${e?.message || e}`);
    err.code = "wasm_load";
    throw err;
  }
  return sqlite3;
}

/**
 * Install the OPFS SAH-pool VFS once. Unlike the classic `opfs` VFS this
 * needs no SharedArrayBuffer and therefore no COOP/COEP headers — it works
 * on any static host and in WebView wrappers. Returns null when unavailable,
 * which silently falls back to in-memory databases.
 */
async function installPool(s) {
  if (pool) return pool;
  try {
    if (!s?.installOpfsSAHPoolVfs) return null;
    // ≥3 handles per DB (db + journal + headroom); 25 corpora max → 80.
    pool = await s.installOpfsSAHPoolVfs({
      initialCapacity: 80,
      directory: "/bible-pool",
    });
    return pool;
  } catch {
    pool = null;
    return null;
  }
}

function unlinkOpfs(p, id) {
  try {
    p?.unlink?.(POOL_PATHS(id));
  } catch {
    /* unlink is best-effort; importDb below replaces the file anyway */
  }
}

async function fetchCorpus(id) {
  const res = await fetch(`/bible/${id}.sqlite`);
  if (!res.ok) {
    const err = new Error(`corpus fetch ${res.status}`);
    err.code = "corpus_fetch";
    throw err;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A truncated download deserializes into nonsense; check the magic header
  // before spending memory on it.
  const magic = "SQLite format 3\0";
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic.charCodeAt(i)) {
      const err = new Error("corpus download was truncated or corrupt");
      err.code = "corpus_fetch";
      throw err;
    }
  }
  return bytes;
}

/** True when the open DB verifiably holds this translation, ready to query. */
function verifyOpen(_s, id, expectedVerses) {
  if (!db) return { ok: false, reason: "no handle" };
  try {
    const count = db.selectValue("select count(*) from verses");
    if (!count) return { ok: false, reason: "empty" };
    const check = db.selectValue("pragma quick_check");
    if (check !== "ok") return { ok: false, reason: `quick_check: ${check}` };
    const ftsTable = db.selectValue(
      "select name from sqlite_master where type='table' and name='verses_fts'"
    );
    if (ftsTable !== "verses_fts") {
      return { ok: false, reason: "fts_missing", code: "fts_missing" };
    }
    const ftsRows = db.selectValue("select count(*) from verses_fts");
    if (ftsRows !== count) {
      return { ok: false, reason: "fts incomplete", code: "fts_missing" };
    }
    if (
      Number.isInteger(expectedVerses) &&
      expectedVerses > 0 &&
      count !== expectedVerses
    ) {
      return { ok: false, reason: `${count}≠${expectedVerses} verses`, code: "count_mismatch" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e), code: "db_corrupt" };
  }
}

/** Close the current handle, if any. */
function closeDb() {
  if (db) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  }
  db = null;
  currentId = null;
}

async function importBytes(s, id, bytes, intoOpfs) {
  if (intoOpfs) {
    unlinkOpfs(pool, id);
    let ok = false;
    try {
      await pool.importDb(POOL_PATHS(id), bytes);
      ok = true;
    } catch {
      // Capacity can run short the first time a corpus lands (db + journal
      // + WAL names). Grow the pool and retry once before giving up.
      try {
        await pool.addCapacity?.(16);
        await pool.importDb(POOL_PATHS(id), bytes);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) throw new Error("opfs import failed");
    closeDb();
    db = new pool.OpfsSAHPoolDb(POOL_PATHS(id), "ct");
  } else {
    closeDb();
    db = new s.oo1.DB(":memory:", "c");
    const p = s.wasm.allocFromTypedArray(bytes);
    s.capi.sqlite3_deserialize(
      db.pointer,
      "main",
      p,
      bytes.length,
      bytes.length,
      s.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
        s.capi.SQLITE_DESERIALIZE_RESIZEABLE
    );
  }
  currentId = id;
  lastOpenPersisted = intoOpfs;
}

async function openDb(id, expectedVerses, bytesIn) {
  if (db && currentId === id) return db;
  closeDb();
  const s = await getSqlite();

  // Persisted path unless the session lost trust in OPFS (or the bytes were
  // handed in and OPFS is already untrusted). The verifier re-validates the
  // file EVERY open, so a half-written copy heals itself instead of
  // poisoning searches.
  const poolOk = await installPool(s);
  if (!avoidOpfs && poolOk) {
    try {
      db = new pool.OpfsSAHPoolDb(POOL_PATHS(id), "ct");
      const verdict = verifyOpen(s, id, expectedVerses);
      if (!verdict.ok) {
        closeDb();
        if (verdict.code === "db_corrupt") {
          unlinkOpfs(pool, id);
        }
        await importBytes(s, id, bytesIn ?? (await fetchCorpus(id)), true);
        const after = verifyOpen(s, id, expectedVerses);
        if (!after.ok) {
          closeDb();
          avoidOpfs = true;
          const err = new Error(
            `OPFS copy failed verification twice: ${after.reason}`
          );
          err.code = after.code || "db_corrupt";
          throw err;
        }
      }
      return db;
    } catch (e) {
      closeDb();
      if (e?.code === "corpus_fetch" || e?.code === "count_mismatch") throw e;
      if (
        e?.code === "db_corrupt" ||
        e?.code === "fts_missing" ||
        e?.code === "wasm_load" ||
        e?.code === "corpus_fetch"
      ) {
        // Re-throwing would abort the caller; instead fall back to memory
        // for this call, and distrust OPFS from here on.
        avoidOpfs = true;
      }
      // any other OPFS failure lands in memory below
    }
  }

  await importBytes(s, id, bytesIn ?? (await fetchCorpus(id)), false);
  const verdict = verifyOpen(s, id, expectedVerses);
  if (!verdict.ok) {
    closeDb();
    const err = new Error(`corpus failed verification: ${verdict.reason}`);
    err.code = verdict.code || "db_corrupt";
    throw err;
  }
  return db;
}

function rows(sql, bind) {
  return db.selectObjects(sql, bind);
}

// CJK (Han) text is not word-segmented, and SQLite's unicode61 FTS tokenizer
// does not split it, so `MATCH` finds almost nothing (e.g. 5 of 4007 hits for
// 神 in a Simplified corpus). The trigram tokenizer needs >=3 characters, so
// it also misses 1-2 character queries. For CJK we therefore use a substring
// scan (instr) over the verses table, which is exact and fast enough.
const CJK_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

function isCjkQuery(s) {
  return CJK_RE.test(s);
}

/**
 * Run a read query with one self-repair retry: if the query dies in a way
 * that says "the database I opened is not the database I needed" (corrupt
 * image, missing FTS), drop the handle, re-import fresh, and retry exactly
 * once. A genuine bad query (`query_failed`) is never retried.
 */
async function queryWithRepair(id, run, expectedVerses, bytesIn) {
  try {
    await openDb(id, expectedVerses, bytesIn);
    return run();
  } catch (e) {
    const soft =
      ["db_corrupt", "fts_missing", "opfs_unavailable", "count_mismatch"].includes(e?.code) ||
      /malformed|no such table|no such module|disk (i\/o )?error/i.test(e?.message || "");
    if (!soft) {
      e.code = e?.code || "query_failed";
      throw e;
    }
    closeDb();
    const s = await getSqlite();
    const poolOk = await installPool(s);
    await importBytes(s, id, bytesIn ?? (await fetchCorpus(id)), Boolean(poolOk) && !avoidOpfs);
    return run();
  }
}

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "open": {
        if (msg.avoidOpfs) avoidOpfs = true;
        await openDb(msg.id, msg.expectedVerses);
        const bounds = rows("select min(book_nr) as lo, max(book_nr) as hi from verses")[0];
        self.postMessage({
          type: "ready",
          id: msg.id,
          bounds,
          persisted: lastOpenPersisted && currentId === msg.id,
        });
        return;
      }
      case "import": {
        if (msg.avoidOpfs) avoidOpfs = true;
        const s = await getSqlite();
        const poolOk = await installPool(s);
        const intoOpfs = Boolean(poolOk) && !avoidOpfs;
        try {
          await importBytes(s, msg.id, new Uint8Array(msg.bytes), intoOpfs);
          await openDb(msg.id, msg.expectedVerses);
        } finally {
          // Release the transferred buffer's memory promptly.
          msg.bytes = null;
        }
        const bounds = rows("select min(book_nr) as lo, max(book_nr) as hi from verses")[0];
        self.postMessage({ type: "ready", id: msg.id, bounds, persisted: intoOpfs });
        return;
      }
      case "chapter": {
        const sql = msg.verse
          ? "select book_nr, chapter, verse, text from verses where book_nr=? and chapter=? and verse=? order by verse"
          : "select book_nr, chapter, verse, text from verses where book_nr=? and chapter=? order by verse";
        const bind = msg.verse
          ? [msg.bookNr, msg.chapter, msg.verse]
          : [msg.bookNr, msg.chapter];
        const out = await queryWithRepair(
          msg.id,
          () => rows(sql, bind),
          msg.expectedVerses
        );
        self.postMessage({ type: "rows", rid: msg.rid, rows: out });
        return;
      }
      case "search": {
        const raw = String(msg.query);
        if (isCjkQuery(raw)) {
          const parts = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
          if (parts.length === 0) {
            self.postMessage({ type: "rows", rid: msg.rid, rows: [] });
            return;
          }
          const where = parts.map(() => "instr(v.text, ?) > 0").join(" and ");
          const sql = `select v.book_nr, v.chapter, v.verse, v.text
            from verses v
            where ${where}
            order by v.book_nr, v.chapter, v.verse
            limit ? offset ?`;
          const out = await queryWithRepair(
            msg.id,
            () => rows(sql, [...parts, msg.limit, msg.offset]),
            msg.expectedVerses
          );
          self.postMessage({ type: "rows", rid: msg.rid, rows: out });
          return;
        }

        // FTS5 MATCH with a prefix on the last term (typeahead feel). The
        // query is tokenised to bare words first so FTS syntax characters
        // can't turn a search into a syntax error.
        const terms = raw
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter(Boolean);
        if (terms.length === 0) {
          self.postMessage({ type: "rows", rid: msg.rid, rows: [] });
          return;
        }
        const match = terms
          .map((t, i) => (i === terms.length - 1 ? `${t}*` : t))
          .join(" ");
        const sql = `
          select v.book_nr, v.chapter, v.verse, v.text, bm25(verses_fts) as score
          from verses_fts f
          join verses v on v.rowid = f.rowid
          where verses_fts match ?
          order by score, v.book_nr, v.chapter, v.verse
          limit ? offset ?`;
        const out = await queryWithRepair(
          msg.id,
          () => rows(sql, [match, msg.limit, msg.offset]),
          msg.expectedVerses
        );
        self.postMessage({ type: "rows", rid: msg.rid, rows: out });
        return;
      }
      case "concordance": {
        const rawWord = String(msg.word);
        if (isCjkQuery(rawWord)) {
          const w = rawWord.trim();
          if (!w) {
            self.postMessage({ type: "rows", rid: msg.rid, rows: [] });
            return;
          }
          const sql = `select v.book_nr, v.chapter, v.verse, v.text
            from verses v
            where instr(v.text, ?) > 0
            order by v.book_nr, v.chapter, v.verse
            limit ?`;
          const out = await queryWithRepair(
            msg.id,
            () => rows(sql, [w, msg.limit]),
            msg.expectedVerses
          );
          self.postMessage({ type: "rows", rid: msg.rid, rows: out });
          return;
        }
        const term = rawWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
        if (!term) {
          self.postMessage({ type: "rows", rid: msg.rid, rows: [] });
          return;
        }
        const sql = `
          select v.book_nr, v.chapter, v.verse, v.text, bm25(verses_fts) as score
          from verses_fts f
          join verses v on v.rowid = f.rowid
          where verses_fts match ?
          order by v.book_nr, v.chapter, v.verse
          limit ?`;
        const out = await queryWithRepair(
          msg.id,
          () => rows(sql, [term, msg.limit]),
          msg.expectedVerses
        );
        self.postMessage({ type: "rows", rid: msg.rid, rows: out });
        return;
      }
      case "persisted": {
        const names = pool?.getFileNames?.() ?? [];
        self.postMessage({ type: "rows", rid: msg.rid, rows: names });
        return;
      }
      case "delete": {
        if (db && currentId === msg.id) {
          closeDb();
        }
        unlinkOpfs(pool, msg.id);
        self.postMessage({ type: "rows", rid: msg.rid, rows: [] });
        return;
      }
      case "close": {
        closeDb();
        return;
      }
      case "resetOpfs": {
        avoidOpfs = false;
        closeDb();
        if (pool) {
          try {
            if (msg.id && msg.id !== "*") {
              unlinkOpfs(pool, msg.id);
            } else {
              pool.wipeFiles?.();
            }
          } catch {
            /* best-effort */
          }
        }
        self.postMessage({ type: "ready", id: msg.id || "reset", bounds: {} });
        return;
      }
      default:
        self.postMessage({
          type: "error",
          rid: msg.rid,
          message: `Unknown message: ${msg.type}`,
          code: "unknown",
        });
    }
  } catch (e) {
    self.postMessage({
      type: "error",
      rid: msg.rid ?? null,
      id: msg.id ?? null,
      code: e?.code || "unknown",
      message: e?.message || String(e),
    });
  }
};
