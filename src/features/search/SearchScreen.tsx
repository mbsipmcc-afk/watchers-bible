import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search as SearchIcon, X } from "lucide-react";
import {
  getLibraryStatus,
  searchBible,
  subscribeLibrary,
  type TranslationId,
  type VerseRow,
} from "../../lib/bible";
import { useSettings } from "../../app/settings-ctx";
import { useManifest } from "../../app/use-manifest";
import { navigate, readHash } from "../../app/router";
import { bookShort } from "../../lib/reference";
import { EmptyState, IconButton, Spinner, TopBar } from "../../components/ui";

const PAGE = 60;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Renders verse text with the search terms marked. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark className="match" key={i}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function SearchScreen({ initialQuery = "" }: { initialQuery?: string }) {
  const { settings } = useSettings();
  const manifestState = useManifest();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<VerseRow[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  // The library status bridge tells us when a first search is really a
  // translation download in disguise (e.g. offline → immediate clear error).
  useEffect(() => {
    const unsub = subscribeLibrary((s) => {
      setOpening(s.phase === "loading" && s.id === settings.translation);
    });
    setOpening(
      getLibraryStatus().phase === "loading" && getLibraryStatus().id === settings.translation,
    );
    return unsub;
  }, [settings.translation]);

  const trMeta = manifestState?.manifest?.translations.find((t) => t.id === settings.translation);
  const terms = useMemo(
    () =>
      q
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean),
    [q],
  );

  // debounced search
  useEffect(() => {
    const trimmed = q.trim();
    const seq = ++searchSeq.current;
    if (!trimmed) {
      setResults(null);
      setDone(false);
      setErr(null);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const rows = await searchBible({
          q: trimmed,
          translation: settings.translation as TranslationId,
          limit: PAGE,
          offset: 0,
        });
        if (seq !== searchSeq.current) return;
        setResults(rows);
        setOffset(rows.length);
        setDone(rows.length < PAGE);
        setErr(null);
      } catch (e) {
        if (seq === searchSeq.current) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (seq === searchSeq.current) setBusy(false);
      }
    }, 260);
    return () => clearTimeout(t);
  }, [q, settings.translation]);

  const loadMore = async () => {
    if (busy || done || !q.trim() || !results) return;
    setBusy(true);
    try {
      const rows = await searchBible({
        q: q.trim(),
        translation: settings.translation as TranslationId,
        limit: PAGE,
        offset,
      });
      setResults((prev) => [...(prev ?? []), ...rows]);
      setOffset((o) => o + rows.length);
      setDone(rows.length < PAGE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TopBar
        left={
          <IconButton label="Back" onClick={() => navigate("#/")}>
            <ArrowLeft size={20} />
          </IconButton>
        }
        title={
          <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
            <SearchIcon size={16} className="shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${trMeta?.abbr ?? "Bible"}…`}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
            {q ? (
              <button
                aria-label="Clear"
                onClick={() => setQ("")}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        }
      />

      <main className="pb-28">
        {!q.trim() ? (
          <EmptyState
            icon={<SearchIcon size={28} />}
            text={`Search every verse of ${trMeta?.name ?? "the Bible"} — instantly, on your device. Quotes, names, topics: everything is full-text indexed.`}
          />
        ) : err ? (
          <EmptyState text={`Search failed: ${err}`} />
        ) : results === null && !busy ? (
          <EmptyState text="Type to search." />
        ) : (
          <>
            <div className="px-4 pb-1 pt-3 text-xs text-muted">
              {opening && !results ? (
                `Opening ${trMeta?.abbr ?? settings.translation.toUpperCase()} — first open downloads it, then it lives on this device…`
              ) : results ? (
                `showing ${results.length} verse${results.length === 1 ? "" : "s"} in ${trMeta?.abbr ?? ""}${done ? "" : " (more available)"}`
              ) : (
                "Searching…"
              )}
            </div>
            {opening && !results ? (
              <div className="flex justify-center pt-2">
                <Spinner />
              </div>
            ) : null}
            <div>
              {(results ?? []).map((r) => (
                <button
                  key={`${r.book_nr}-${r.chapter}-${r.verse}`}
                  onClick={() =>
                    navigate(
                      readHash(String(settings.translation), r.book_nr, r.chapter, r.verse),
                    )
                  }
                  className="block w-full border-b border-border px-4 py-3 text-left active:bg-surface2"
                >
                  <span className="block pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    {bookShort(r.book_nr)} {r.chapter}:{r.verse}
                  </span>
                  <span className="reader-verse block leading-snug" style={{ fontSize: 14 }}>
                    <Marked text={r.text} terms={terms} />
                  </span>
                </button>
              ))}
            </div>
            {busy ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : !done && results && results.length > 0 ? (
              <div className="flex justify-center py-4">
                <button
                  onClick={loadMore}
                  className="h-10 rounded-xl bg-surface2 px-5 text-sm font-medium"
                >
                  Load more
                </button>
              </div>
            ) : results && results.length === 0 ? (
              <EmptyState text={`No verses match “${q}” in ${trMeta?.abbr ?? "this translation"}.`} />
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
