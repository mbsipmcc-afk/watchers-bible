import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Languages,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import {
  BibleError,
  chapterVerses,
  openTranslation,
  type BookMeta,
  type TranslationId,
  type VerseRow,
} from "../../lib/bible";
import {
  addBookmark,
  getState,
  removeBookmark,
  removeHighlight,
  saveLastRead,
  setHighlight,
  db,
  type LastRead,
  type NoteRow,
} from "../../lib/userdata";
import { useSettings } from "../../app/settings-ctx";
import { useManifest } from "../../app/use-manifest";
import { navigate, readHash, type Route } from "../../app/router";
import { bookLabel, fmtShareText } from "../../lib/reference";
import { EmptyState, IconButton, SkeletonRows, Spinner, TopBar } from "../../components/ui";
import { BookPicker } from "./BookPicker";
import { ReaderSheet } from "./ReaderSheet";
import { NoteSheet } from "./NoteSheet";
import { VerseActionBar } from "./VerseActionBar";
import { TranslationSheet } from "./TranslationSheet";

type Pos = {
  translation: TranslationId;
  book: number;
  chapter: number;
  verse?: number;
};

export default function ReaderScreen({ route }: { route: Route & { name: "read" } }) {
  const { settings, update } = useSettings();
  const manifestState = useManifest();

  const [pos, setPos] = useState<Pos | null>(null);
  const [verses, setVerses] = useState<VerseRow[] | null>(null);
  const [err, setErr] = useState<BibleError | null>(null);
  const [sheet, setSheet] = useState<"none" | "books" | "display" | "tr">("none");
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [trPersist, setTrPersist] = useState<boolean | undefined>(undefined);
  const [corpusBounds, setCorpusBounds] = useState<{ lo: number; hi: number } | null>(null);

  // chapter study data
  const [hl, setHl] = useState<Map<number, number>>(new Map());
  const [notes, setNotes] = useState<Map<number, number>>(new Map());
  const [marked, setMarked] = useState<Set<number>>(new Set());

  // note sheet state: verse + existing row
  const [noteOpen, setNoteOpen] = useState<
    { verse: number; row: NoteRow | undefined } | null
  >(null);

  const books = manifestState?.books ?? null;
  const manifest = manifestState?.manifest ?? null;

  const trMeta = useMemo(
    () => manifest?.translations.find((t) => t.id === pos?.translation),
    [manifest, pos],
  );

  const bookMeta = useMemo(() => books?.find((b) => b.nr === pos?.book) ?? null, [books, pos]);

  /* ── resolve position from route / lastRead / defaults ─────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (route.translation && route.book && route.chapter) {
        const valid =
          !manifest || manifest.translations.some((t) => t.id === route.translation);
        if (alive) {
          setPos({
            translation: (valid ? route.translation : settings.translation) as TranslationId,
            book: route.book,
            chapter: route.chapter,
            verse: route.verse,
          });
        }
        return;
      }
      const lr = await getState<LastRead>("lastRead");
      if (!alive) return;
      const t = (route.translation ?? lr?.translation ?? settings.translation) as TranslationId;
      setPos({
        translation: t,
        book: route.book ?? lr?.book ?? 1,
        chapter: route.chapter ?? lr?.chapter ?? 1,
        verse: route.verse,
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.translation, route.book, route.chapter, route.verse, manifest]);

  /* ── load verses ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!pos) return;
    let alive = true;
    setVerses(null);
    setErr(null);
    setSelection(new Set());
    setTrPersist(undefined);

    const expected = manifest?.translations.find((t) => t.id === pos.translation)?.verses;

    openTranslation(pos.translation, expected)
      .then((info) => {
        if (!alive) return undefined;
        setTrPersist(info.persisted);
        if (Number.isFinite(info.lo) && Number.isFinite(info.hi) && info.hi > 0) {
          setCorpusBounds({ lo: info.lo, hi: info.hi });
        }
        return chapterVerses({
          translation: pos.translation,
          bookNr: pos.book,
          chapter: pos.chapter,
        });
      })
      .then((v) => {
        if (!alive || !v) return;
        setVerses(v);
        saveLastRead({
          translation: pos.translation,
          book: pos.book,
          chapter: pos.chapter,
          verse: pos.verse,
          at: Date.now(),
        });
        if (pos.verse) {
          setTimeout(() => {
            document
              .getElementById(`v${pos.verse}`)
              ?.scrollIntoView({ block: "center", behavior: "smooth" });
          }, 60);
        } else {
          window.scrollTo({ top: 0 });
        }
      })
      .catch((e) => {
        if (alive) setErr(e instanceof BibleError ? e : new BibleError("unknown", String(e)));
      });

    return () => {
      alive = false;
    };
  }, [pos, manifest]);

  /* ── chapter study data ────────────────────────────────────────────────── */
  const refreshChapterData = useCallback(async () => {
    if (!pos) return;
    const [hRows, nRows, bRows] = await Promise.all([
      db.highlights
        .filter(
          (r) =>
            r.book === pos.book && r.chapter === pos.chapter && r.translation === pos.translation,
        )
        .toArray(),
      db.notes
        .filter(
          (r) =>
            r.book === pos.book && r.chapter === pos.chapter && r.translation === pos.translation,
        )
        .toArray(),
      db.bookmarks
        .filter(
          (r) =>
            r.book === pos.book && r.chapter === pos.chapter && r.translation === pos.translation,
        )
        .toArray(),
    ]);
    setHl(new Map(hRows.map((r) => [r.verse, r.color])));
    setNotes(new Map(nRows.filter((r) => r.body).map((r) => [r.verse, r.id!])));
    setMarked(new Set(bRows.map((r) => r.verse)));
  }, [pos]);

  useEffect(() => {
    refreshChapterData();
  }, [refreshChapterData]);

  /* ── selection actions ─────────────────────────────────────────────────── */

  const selectedRows = useMemo(
    () => (verses ?? []).filter((v) => selection.has(v.verse)),
    [verses, selection],
  );

  const allBookmarked =
    selectedRows.length > 0 && selectedRows.every((v) => marked.has(v.verse));

  const toggleSelection = (verse: number) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(verse)) next.delete(verse);
      else next.add(verse);
      return next;
    });
  };

  const applyHighlight = async (color: number) => {
    if (!pos) return;
    for (const r of selectedRows) {
      await setHighlight(pos.translation, pos.book, pos.chapter, r.verse, color);
    }
    await refreshChapterData();
    setSelection(new Set());
  };

  const clearHighlight = async () => {
    if (!pos) return;
    for (const r of selectedRows) {
      await removeHighlight(pos.translation, pos.book, pos.chapter, r.verse);
    }
    await refreshChapterData();
    setSelection(new Set());
  };

  const toggleBookmark = async () => {
    if (!pos) return;
    if (allBookmarked) {
      for (const r of selectedRows) {
        await removeBookmark(pos.translation, pos.book, pos.chapter, r.verse);
      }
    } else {
      for (const r of selectedRows) {
        await addBookmark(pos.translation, pos.book, pos.chapter, r.verse);
      }
    }
    await refreshChapterData();
    setSelection(new Set());
  };

  const openNoteFor = useCallback(
    async (verse: number) => {
      if (!pos) return;
      const row = await db.notes
        .filter(
          (r) =>
            r.book === pos.book &&
            r.chapter === pos.chapter &&
            r.verse === verse &&
            r.translation === pos.translation &&
            !!r.body,
        )
        .last();
      setNoteOpen({ verse, row: row ?? undefined });
    },
    [pos],
  );

  const openNote = () => {
    if (selectedRows.length === 0) return;
    const verse = selectedRows[selectedRows.length - 1].verse;
    openNoteFor(verse);
  };

  const copyOrShare = async (share: boolean) => {
    if (!pos) return;
    const text = fmtShareText(
      pos.book,
      pos.chapter,
      trMeta?.abbr,
      selectedRows,
      [...selection].sort((a, b) => a - b),
      bookLabel(pos.book, settings.bookNames, books),
    );
    try {
      if (share && navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("Copied");
    } catch {
      /* clipboard denied; ignore */
    }
  };

  const linkFor = (verse?: number) =>
    `${location.origin}${location.pathname}${readHash(pos!.translation, pos!.book, pos!.chapter, verse)}`;

  const copyLink = async (verse?: number) => {
    try {
      await navigator.clipboard.writeText(linkFor(verse));
      showToast("Link copied");
    } catch {
      /* clipboard denied */
    }
  };

  const shareLink = async () => {
    if (!pos) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${bookLabel(pos.book, settings.bookNames, books)} ${pos.chapter}`,
          url: linkFor(),
        });
        return;
      }
      await navigator.clipboard.writeText(linkFor());
      showToast("Link copied");
    } catch {
      /* share dismissed */
    }
  };

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1600);
  };

  /* ── chapter navigation ────────────────────────────────────────────────── */

  const gotoBook = (book: BookMeta, chapter: number) => {
    if (!pos) return;
    update({ translation: pos.translation });
    navigate(readHash(pos.translation, book.nr, chapter));
    setSheet("none");
  };

  const stepChapter = useCallback(
    (dir: 1 | -1) => {
      if (!pos || !books) return;
      const idx = books.findIndex((b) => b.nr === pos.book);
      const b = books[idx];
      if (!b) return;
      if (dir === 1 && pos.chapter < b.chapters) {
        navigate(readHash(pos.translation, pos.book, pos.chapter + 1));
      } else if (dir === 1 && idx + 1 < books.length) {
        navigate(readHash(pos.translation, books[idx + 1].nr, 1));
      } else if (dir === -1 && pos.chapter > 1) {
        navigate(readHash(pos.translation, pos.book, pos.chapter - 1));
      } else if (dir === -1 && idx - 1 >= 0) {
        navigate(readHash(pos.translation, books[idx - 1].nr, books[idx - 1].chapters));
      }
    },
    [pos, books],
  );

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      stepChapter(dx < 0 ? 1 : -1);
    }
  };

  /* ── render ────────────────────────────────────────────────────────────── */

  const title = bookMeta
    ? `${bookLabel(pos?.book ?? 1, settings.bookNames, books)} ${pos?.chapter ?? 1} · ${trMeta?.abbr ?? ""}`
    : "Bible";

  return (
    <div>
      <TopBar
        left={
          <IconButton label="Back" onClick={() => navigate("#/")}>
            <ArrowLeft size={20} />
          </IconButton>
        }
        title={title}
        onClickTitle={() => setSheet("books")}
        right={
          <>
            <IconButton label="Share chapter link" onClick={shareLink}>
              <Share2 size={20} />
            </IconButton>
            <IconButton label="Translation" onClick={() => setSheet("tr")}>
              <Languages size={20} />
            </IconButton>
            <IconButton label="Display" onClick={() => setSheet("display")}>
              <SlidersHorizontal size={20} />
            </IconButton>
          </>
        }
      />

      <main className="px-3 pb-28 pt-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {err ? <ErrorCard err={err} onRetry={() => pos && setPos({ ...pos })} /> : null}

        {!verses && !err ? (
          <div className="pt-6" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-2 pb-6 text-muted">
              <Spinner />
              <p className="text-sm">
                Loading {bookLabel(pos?.book ?? 1, settings.bookNames, books)}{" "}
                {pos?.chapter ?? 1}
              </p>
              {trPersist === false && trMeta ? (
                <p className="text-center text-xs text-muted">
                  First open of {trMeta.abbr} downloads ~
                  {Math.max(1, Math.round((trMeta.bytes ?? 0) / 1e6))} MB · then it's stored on
                  your device
                </p>
              ) : null}
            </div>
            <div className="mt-4">
              <SkeletonRows rows={6} tall />
            </div>
          </div>
        ) : null}

        {verses && verses.length === 0 ? (
          <EmptyState text="This chapter is not part of this edition (OT/NT-only corpus)." />
        ) : null}

        {verses && verses.length > 0 && pos ? (
          <div
            key={`${pos.translation}-${pos.book}-${pos.chapter}`}
            className={`chapter-in select-text ${settings.dropCap ? "dropcap" : ""}`}
          >
            {verses.map((v, i) => {
              const hlColor = hl.get(v.verse);
              const isSel = selection.has(v.verse);
              return (
                <p
                  id={`v${v.verse}`}
                  key={v.verse}
                  onClick={() => toggleSelection(v.verse)}
                  data-highlight={hlColor ?? undefined}
                  style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                  className={`reader-verse verse-in -mx-2 cursor-pointer rounded-lg px-2 py-0.5 ${
                    isSel ? "bg-[var(--c-verse-sel)]" : ""
                  }`}
                >
                  <span className="verse-num">{v.verse}</span>
                  <span className="verse-body">{v.text}</span>
                  {notes.has(v.verse) ? (
                    <button
                      aria-label={`Open note on verse ${v.verse}`}
                      title="Open note"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNoteFor(v.verse);
                      }}
                      className="verse-note-dot"
                    />
                  ) : null}
                  {marked.has(v.verse) ? (
                    <span className="gold-text text-[0.85em]" aria-label="Bookmarked">
                      {" ⚑"}
                    </span>
                  ) : null}
                </p>
              );
            })}
          </div>
        ) : null}

        {verses && verses.length > 0 && pos ? (
          <div className="fade-up mt-8 flex items-center justify-between gap-3" style={{ animationDelay: "120ms" }}>
            <button
              onClick={() => stepChapter(-1)}
              className="press flex h-11 items-center gap-1 rounded-xl border border-border bg-surface px-4 text-sm font-medium"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <ChevronLeft size={18} className="text-accent" /> Previous
            </button>
            <button
              onClick={() => stepChapter(1)}
              className="press flex h-11 items-center gap-1 rounded-xl border border-border bg-surface px-4 text-sm font-medium"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              Next <ChevronRight size={18} className="text-accent" />
            </button>
          </div>
        ) : null}
      </main>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pop-in fixed inset-x-0 bottom-28 z-40 mx-auto w-fit rounded-full bg-fg px-4 py-1.5 text-sm text-app shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      {selection.size > 0 && pos ? (
        <VerseActionBar
          count={selection.size}
          allBookmarked={allBookmarked}
          onHighlight={applyHighlight}
          onClearHighlight={clearHighlight}
          onBookmark={toggleBookmark}
          onNote={openNote}
          onCopy={() => copyOrShare(false)}
          onCopyLink={() => {
            const v = selectedRows[selectedRows.length - 1]?.verse;
            copyLink(selectedRows.length === 1 ? v : undefined);
          }}
          onShare={() => copyOrShare(true)}
          onClearSelection={() => setSelection(new Set())}
        />
      ) : null}

      <BookPicker
        open={sheet === "books"}
        onClose={() => setSheet("none")}
        books={books}
        bounds={corpusBounds}
        corpusNote={
          trMeta
            ? `${trMeta.name} — ${
                trMeta.books === 66
                  ? "complete Bible"
                  : trMeta.books === 27
                    ? "New Testament only"
                    : "Old Testament only"
              }`
            : undefined
        }
        currentBook={pos?.book}
        currentChapter={pos?.chapter}
        bookLang={settings.bookNames}
        otherLang={settings.bookNames === "en" ? "tl" : "en"}
        onPick={gotoBook}
      />

      <ReaderSheet open={sheet === "display"} onClose={() => setSheet("none")} />

      <TranslationSheet
        open={sheet === "tr"}
        onClose={() => setSheet("none")}
        current={pos?.translation ?? settings.translation}
        onPick={(id) => {
          if (!pos) return;
          update({ translation: id });
          navigate(readHash(id, pos.book, pos.chapter));
        }}
      />

      {noteOpen && pos ? (
        <NoteSheet
          open
          onClose={() => setNoteOpen(null)}
          note={noteOpen.row}
          refLabel={`${bookLabel(pos.book, settings.bookNames, books)} ${pos.chapter}:${noteOpen.verse}`}
          translation={pos.translation}
          book={pos.book}
          chapter={pos.chapter}
          verse={noteOpen.verse}
          onSaved={refreshChapterData}
        />
      ) : null}
    </div>
  );
}

function ErrorCard({ err, onRetry }: { err: BibleError; onRetry: () => void }) {
  const offline =
    typeof navigator !== "undefined" &&
    navigator.onLine === false &&
    (err.code === "corpus_fetch" || err.code === "open_timeout");
  return (
    <div className="g-border fade-up mx-1 rounded-2xl p-5">
      <p className="text-sm font-semibold">
        {offline
          ? "You're offline"
          : err.code === "open_timeout"
            ? "Opening the translation timed out"
            : err.code === "corpus_fetch"
              ? "Couldn't download the translation text"
              : "Something went wrong reading this chapter"}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {offline
          ? "This translation needs one online visit to download. After that it works fully offline."
          : err.message || err.code}
      </p>
      <button
        onClick={onRetry}
        className="mt-4 h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg"
      >
        Retry
      </button>
    </div>
  );
}
