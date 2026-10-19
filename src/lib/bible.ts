"use client";

/**
 * Client-side Bible database facade.
 *
 * Wraps the SQLite WASM worker in promises so the app can
 * `await chapterVerses(...)` — every byte is local. The corpus travels as a
 * static /bible/<id>.sqlite file; a translation downloaded once is persisted
 * in OPFS (via the worker's SAH-pool VFS) and survives reloads. The service
 * worker additionally caches corpus files so the self-heal path also works
 * offline.
 *
 * The failure contract: NOTHING may hang. Every phase is wall-clock bounded,
 * every timeout kills the wedged worker outright and rebuilds it, and the
 * retry after a timeout runs the OPFS-free deterministic path. Failures
 * carry a machine `code` the UI maps to plain-English recovery steps.
 */

export type TranslationId =
  | "kjv" | "web" | "adb" | "ceb" | "chiun" | "tsg" | "tr" | "wlc"
  | "bsb" | "asv" | "ylt" | "net" | "gnv" | "lsv" | "tlv" | "cjb"
  | "tb" | "rv1960" | "synod" | "ubio" | "vi1934" | "hiov" | "tamovr" | "krv" | "cunps";

export type VerseRow = {
  book_nr: number;
  chapter: number;
  verse: number;
  text: string;
  score?: number;
};

export type BookMeta = {
  nr: number;
  abbr: string;
  name_en: string;
  name_tl: string;
  chapters: number;
  testament: "OT" | "NT";
};

export type BibleErrorCode =
  | "worker_spawn"
  | "wasm_load"
  | "corpus_fetch"
  | "opfs_unavailable"
  | "db_corrupt"
  | "fts_missing"
  | "count_mismatch"
  | "query_failed"
  | "open_timeout"
  | "request_timeout"
  | "manifest_failed"
  | "unknown";

export class BibleError extends Error {
  code: BibleErrorCode;
  constructor(code: BibleErrorCode, message: string) {
    super(message);
    this.name = "BibleError";
    this.code = code;
  }
}

type ReadyInfo = { lo: number; hi: number; persisted?: boolean };
type Pending = {
  resolve: (rows: unknown[]) => void;
  reject: (err: Error) => void;
};
type ReadyPending = {
  resolve: (info: ReadyInfo) => void;
  reject: (err: Error) => void;
};

const OPEN_TIMEOUT_MS = 25_000;
const IMPORT_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

/* ── Library event bridge ────────────────────────────────────────────────── */

export type LibraryPhase = "idle" | "loading" | "ready" | "error";

export interface LibraryStatus {
  phase: LibraryPhase;
  id?: TranslationId;
  code?: BibleErrorCode;
  at: number;
}

let libraryStatus: LibraryStatus = { phase: "idle", at: 0 };

function setLibrary(
  phase: LibraryPhase,
  extra?: { id?: TranslationId; code?: BibleErrorCode },
) {
  libraryStatus = { phase, at: Date.now(), ...extra };
  try {
    window.dispatchEvent(
      new CustomEvent("wb-bible-library", { detail: libraryStatus }),
    );
  } catch {
    /* no DOM (test env): state stays readable via getLibraryStatus */
  }
}

export function getLibraryStatus(): LibraryStatus {
  return libraryStatus;
}

export function subscribeLibrary(cb: (status: LibraryStatus) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<LibraryStatus>).detail);
  window.addEventListener("wb-bible-library", handler);
  return () => window.removeEventListener("wb-bible-library", handler);
}

/* ── Worker lifecycle ─────────────────────────────────────────────────────── */

let worker: Worker | null = null;
let workerBroken = false;
let blobFallbackEngaged = false;
let workerCreation: Promise<Worker> | null = null;
let workerGeneration = 0;
let stuckAvoidOpfs = false;
let rid = 0;
const pending = new Map<number, Pending>();
const readyPending = new Map<string, ReadyPending>();

function rejectAllReady(error: Error): void {
  for (const p of readyPending.values()) p.reject(error);
  readyPending.clear();
}

function rejectAllPending(error: Error): void {
  for (const p of pending.values()) p.reject(error);
  pending.clear();
}

function terminateWorker(): void {
  const w = worker;
  worker = null;
  workerGeneration += 1;
  if (w) {
    try {
      w.terminate();
    } catch {
      /* already gone */
    }
  }
}

/** A wedged worker cannot receive messages; a retry must start from a NEW thread. */
function rebuildWorker(): void {
  terminateWorker();
}

function handleWorkerError(w: Worker, e: ErrorEvent): void {
  const err = new BibleError("worker_spawn", e.message || "Bible worker failed");
  rejectAllPending(err);
  rejectAllReady(err);
  openPromises.clear();
  workerBroken = true;
  if (w === worker) worker = null;
  workerGeneration += 1;
}

/**
 * A worker replacement (URL worker -> blob fallback) quietly rejects every
 * in-flight call. Transparently retry the operation once against the NEXT
 * generation so a mid-session replacement never surfaces as a failed search;
 * genuine query errors are not retried (no generation bump).
 */
async function withWorkerRetry<T>(op: () => Promise<T>): Promise<T> {
  const gen = workerGeneration;
  try {
    return await op();
  } catch (err) {
    if (workerGeneration === gen) throw err;
    return await op();
  }
}

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  code: BibleErrorCode,
  what: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new BibleError(code, `${what} took longer than ${Math.round(ms / 1000)}s`)),
      ms,
    );
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Blob fallback worker: same source, rewritten to absolute module paths and
 * with OPFS disabled, for environments where the module worker fails to
 * spawn. Runs the deterministic in-memory path.
 */
async function createBlobWorker(): Promise<Worker> {
  const res = await fetch("/sqlite/bible-worker.mjs");
  if (!res.ok) throw new BibleError("worker_spawn", `worker source ${res.status}`);
  const raw = await res.text();
  const origin = self.location.origin;
  const patched = raw
    .replace(
      'import("/sqlite/sqlite3.mjs")',
      () => `import(${JSON.stringify(origin + "/sqlite/sqlite3.mjs")})`,
    )
    .replace(
      "locateFile: (file) => `/sqlite/${file}`",
      () => `locateFile: (file) => ${JSON.stringify(origin + "/sqlite/")}.concat(file)`,
    )
    .replace(
      "fetch(`/bible/${id}.sqlite`)",
      () => `fetch(${JSON.stringify(origin + "/bible/")}.concat(id, ".sqlite"))`,
    )
    .split("const poolOk = await installPool(s);")
    .join("const poolOk = null;");
  const url = URL.createObjectURL(new Blob([patched], { type: "text/javascript" }));
  return new Worker(url, { type: "module" });
}

function attachWorker(w: Worker): Worker {
  w.onmessage = (event: MessageEvent) => {
    const m = event.data;
    if (m.type === "ready") {
      readyPending.get(m.id)?.resolve({
        lo: m.bounds?.lo ?? 0,
        hi: m.bounds?.hi ?? 0,
        persisted: m.persisted,
      });
      readyPending.delete(m.id);
      return;
    }
    if (m.type === "rows") {
      pending.get(m.rid)?.resolve(m.rows ?? []);
      pending.delete(m.rid);
      return;
    }
    if (m.type === "error") {
      const err = new BibleError(
        (m.code as BibleErrorCode) || "unknown",
        m.message || "Bible database error",
      );
      if (m.rid != null && pending.has(m.rid)) {
        pending.get(m.rid)!.reject(err);
        pending.delete(m.rid);
      }
      if (m.id != null && readyPending.has(m.id)) {
        readyPending.get(m.id)!.reject(err);
        readyPending.delete(m.id);
        openPromises.delete(m.id);
      }
      if (err.code === "db_corrupt" || err.code === "fts_missing") {
        stuckAvoidOpfs = true;
      }
    }
  };
  w.onerror = (e) => handleWorkerError(w, e as ErrorEvent);
  return w;
}

async function ensureWorker(): Promise<Worker> {
  if (worker) return worker;
  if (workerCreation) return workerCreation;
  workerCreation = (async () => {
    let created: Worker;
    try {
      if (blobFallbackEngaged) {
        created = await createBlobWorker();
      } else if (workerBroken) {
        blobFallbackEngaged = true;
        created = await createBlobWorker();
      } else {
        created = new Worker("/sqlite/bible-worker.mjs", { type: "module" });
      }
    } catch (e) {
      throw new BibleError(
        "worker_spawn",
        e instanceof Error ? e.message : String(e),
      );
    }
    worker = attachWorker(created);
    return worker;
  })();
  try {
    return await workerCreation;
  } finally {
    workerCreation = null;
  }
}

const openPromises = new Map<string, Promise<ReadyInfo>>();

/** Open (loading/importing if needed) a translation; resolves once queryable. */
export function openTranslation(
  id: TranslationId,
  expectedVerses?: number,
): Promise<ReadyInfo> {
  const cached = openPromises.get(id);
  if (cached) return cached;
  const p = (async () => {
    const attempt = (avoidOpfs: boolean) => readyRequest(id, { type: "open", id, expectedVerses, avoidOpfs }, OPEN_TIMEOUT_MS);
    try {
      return await attempt(stuckAvoidOpfs);
    } catch (first) {
      openPromises.delete(id);
      const recoverable =
        (first as BibleError).code === "open_timeout" ||
        (first as BibleError).code === "opfs_unavailable" ||
        (first as BibleError).code === "worker_spawn";
      if (!recoverable) throw first;
      stuckAvoidOpfs = true;
      rebuildWorker();
      return await attempt(true);
    }
  })();
  openPromises.set(id, p);
  return p;
}

function readyRequest(
  key: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<ReadyInfo> {
  setLibrary("loading", { id: key as TranslationId });
  return withTimeout(
    new Promise<ReadyInfo>((resolve, reject) => {
      ensureWorker()
        .then((w) => {
          readyPending.set(key, {
            resolve: (info) => {
              resolve(info);
              setLibrary("ready", { id: key as TranslationId });
            },
            reject: (err) => {
              reject(err);
              setLibrary("error", {
                id: key as TranslationId,
                code: (err as BibleError).code ?? "unknown",
              });
            },
          });
          w.postMessage(body);
        })
        .catch(reject);
    }),
    timeoutMs,
    "open_timeout",
    "Opening",
  );
}

async function request(
  id: TranslationId,
  body: Record<string, unknown>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown[]> {
  const w = await ensureWorker();
  const r = ++rid;
  try {
    return await withTimeout(
      new Promise<unknown[]>((resolve, reject) => {
        pending.set(r, { resolve, reject });
        w.postMessage({ id, rid: r, ...body });
      }),
      timeoutMs,
      "request_timeout",
      "Querying",
    );
  } catch (e) {
    if (e instanceof BibleError && e.code === "request_timeout") {
      // A timed-out query means nobody is answering: the thread is wedged on
      // a sync call. Terminate so the next attempt runs on a brand-new worker.
      rebuildWorker();
    }
    throw e;
  }
}

export async function chapterVerses({
  translation,
  bookNr,
  chapter,
  verse,
}: {
  translation: TranslationId;
  bookNr: number;
  chapter: number;
  verse?: number | null;
}): Promise<VerseRow[]> {
  const expected = await expectedVersesFor(translation);
  const rows = await withWorkerRetry(async () => {
    await openTranslation(translation, expected);
    return await request(translation, {
      type: "chapter",
      bookNr,
      chapter,
      verse: verse ?? null,
      expectedVerses: expected,
    });
  });
  return rows as VerseRow[];
}

export async function searchBible({
  q,
  translation,
  limit,
  offset,
}: {
  q: string;
  translation: TranslationId;
  limit: number;
  offset: number;
}): Promise<VerseRow[]> {
  const expected = await expectedVersesFor(translation);
  const rows = await withWorkerRetry(async () => {
    await openTranslation(translation, expected);
    return await request(translation, {
      type: "search",
      query: q,
      limit,
      offset,
      expectedVerses: expected,
    });
  });
  return rows as VerseRow[];
}

export async function concordance({
  word,
  translation,
  limit = 400,
}: {
  word: string;
  translation: TranslationId;
  limit?: number;
}): Promise<VerseRow[]> {
  const expected = await expectedVersesFor(translation);
  const rows = await withWorkerRetry(async () => {
    await openTranslation(translation, expected);
    return await request(translation, {
      type: "concordance",
      word,
      limit,
      expectedVerses: expected,
    });
  });
  return rows as VerseRow[];
}

/**
 * Feed pre-downloaded corpus bytes straight into the worker (UI shows real
 * download progress, then the worker persists + opens). Resolves the same
 * ReadyInfo as openTranslation; `persisted` says whether OPFS was used.
 */
export async function importCorpus({
  id,
  bytes,
  expectedVerses,
}: {
  id: TranslationId;
  bytes: ArrayBuffer;
  expectedVerses?: number;
}): Promise<ReadyInfo> {
  const existing = openPromises.get(id);
  if (existing) return existing;
  const attempt = (avoidOpfs: boolean) =>
    withTimeout(
      readyWithBytes(id, { type: "import", id, bytes, expectedVerses, avoidOpfs }),
      IMPORT_TIMEOUT_MS,
      "open_timeout",
      "Importing",
    );
  const p = (async () => {
    try {
      return await attempt(stuckAvoidOpfs);
    } catch (e) {
      const code = (e as BibleError).code;
      if (code === "open_timeout" || code === "opfs_unavailable" || code === "db_corrupt" || code === "worker_spawn") {
        stuckAvoidOpfs = true;
        rebuildWorker();
        return await attempt(true);
      }
      throw e;
    }
  })();
  openPromises.set(id, p);
  try {
    return await p;
  } catch (e) {
    openPromises.delete(id);
    throw e;
  }
}

function readyWithBytes(
  key: string,
  body: Record<string, unknown>,
): Promise<ReadyInfo> {
  return new Promise<ReadyInfo>((resolve, reject) => {
    ensureWorker()
      .then((w) => {
        readyPending.set(key, { resolve, reject });
        w.postMessage(body);
      })
      .catch(reject);
  });
}

/** Names of corpora persisted in OPFS, as ["bible-kjv.sqlite3", ...]. */
export async function listPersisted(): Promise<string[]> {
  try {
    const w = await ensureWorker();
    const r = ++rid;
    const rows = await withTimeout(
      new Promise<unknown[]>((resolve, reject) => {
        pending.set(r, { resolve, reject });
        w.postMessage({ type: "persisted", rid: r });
      }),
      REQUEST_TIMEOUT_MS,
      "request_timeout",
      "Listing",
    );
    return rows as string[];
  } catch {
    return [];
  }
}

/**
 * Translation ids persisted in OPFS, normalized: pool file names come back
 * as "/bible-kjv.sqlite3", the manifest ids are "kjv". Single source of
 * truth for every "is this translation on the device?" check.
 */
export async function persistedTranslationIds(): Promise<Set<TranslationId>> {
  try {
    const names = await listPersisted();
    const ids = names
      .map((n) => n.replace(/^\/?bible-/, "").replace(/\.sqlite3$/, ""))
      .filter((s) => s.length > 0 && s !== "*");
    return new Set(ids as TranslationId[]);
  } catch {
    return new Set();
  }
}

/** Remove one persisted corpus from OPFS. Best-effort. */
export async function deleteTranslation(id: TranslationId): Promise<void> {
  try {
    const w = await ensureWorker();
    const r = ++rid;
    await withTimeout(
      new Promise<unknown[]>((resolve, reject) => {
        pending.set(r, { resolve, reject });
        w.postMessage({ type: "delete", id, rid: r });
      }),
      REQUEST_TIMEOUT_MS,
      "request_timeout",
      "Deleting",
    );
  } catch {
    /* best-effort */
  }
  openPromises.delete(id);
}

/** Full reset: wipes every persisted corpus from OPFS and rebuilds the worker. */
export async function resetLibrary(): Promise<{ removed: string[] }> {
  let removed: string[] = [];
  try {
    removed = await listPersisted();
  } catch {
    /* ignore */
  }
  try {
    const w = await ensureWorker();
    const r = ++rid;
    await withTimeout(
      new Promise<unknown[]>((resolve, reject) => {
        pending.set(r, { resolve, reject });
        w.postMessage({ type: "resetOpfs", id: "*", rid: r });
      }),
      REQUEST_TIMEOUT_MS,
      "request_timeout",
      "Resetting",
    );
  } catch {
    /* a dead worker is exactly what the reset is for */
  }
  stuckAvoidOpfs = false;
  rebuildWorker();
  openPromises.clear();
  return { removed };
}

/* ── Manifest ─────────────────────────────────────────────────────────────── */

export type BibleManifest = {
  generatedAt: string;
  books: [number, string, string, string, number, "OT" | "NT"][];
  translations: {
    id: TranslationId;
    name: string;
    abbr: string;
    lang: string;
    verses: number;
    books: number;
    file: string;
    bytes: number;
  }[];
};

let manifestPromise: Promise<BibleManifest> | null = null;

export function loadManifest(): Promise<BibleManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch("/bible/manifest.json")
      .then((r) => {
        if (!r.ok) throw new BibleError("manifest_failed", `manifest ${r.status}`);
        return r.json() as Promise<BibleManifest>;
      })
      .catch((e) => {
        manifestPromise = null;
        throw e;
      });
  }
  return manifestPromise;
}

export function reloadManifest(): void {
  manifestPromise = null;
}

export async function expectedVersesFor(id: TranslationId): Promise<number | undefined> {
  try {
    const m = await loadManifest();
    return m.translations.find((t) => t.id === id)?.verses;
  } catch {
    return undefined;
  }
}

export function manifestBooks(m: BibleManifest): BookMeta[] {
  return m.books.map((b) => ({
    nr: b[0],
    abbr: b[1],
    name_en: b[2],
    name_tl: b[3],
    chapters: b[4],
    testament: b[5],
  }));
}

/** ISO-ish corpus language codes → display names. */
const LANG_NAMES: Record<string, string> = {
  en: "English",
  tl: "Tagalog",
  ceb: "Cebuano",
  tsg: "Tausug",
  zh: "Chinese",
  ko: "Korean",
  es: "Spanish",
  ru: "Russian",
  ta: "Tamil",
  id: "Indonesian",
  uk: "Ukrainian",
  vi: "Vietnamese",
  hi: "Hindi",
  grc: "Koine Greek",
  hbo: "Biblical Hebrew",
};

export function translationLangName(lang: string): string {
  return LANG_NAMES[lang.toLowerCase()] ?? lang.toUpperCase();
}

export { openPromises as __openTranslationsForTest };
