import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { BookMeta } from "../../lib/bible";
import { Sheet, Spinner } from "../../components/ui";
import type { BookNamesLang } from "../../lib/settings";

export function BookPicker({
  open,
  onClose,
  books,
  bounds,
  corpusNote,
  currentBook,
  currentChapter,
  bookLang,
  otherLang,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  books: BookMeta[] | null;
  bounds: { lo: number; hi: number } | null;
  corpusNote?: string;
  currentBook?: number;
  currentChapter?: number;
  bookLang: BookNamesLang;
  otherLang: BookNamesLang;
  onPick: (book: BookMeta, chapter: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const [openBook, setOpenBook] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setOpenBook(currentBook ?? null);
      setFilter("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nameIn = (b: BookMeta, lang: BookNamesLang) =>
    lang === "tl" ? b.name_tl || b.name_en : b.name_en;

  const visibleBooks = useMemo(() => {
    if (!books) return null;
    const f = filter.trim().toLowerCase();
    const inBounds = bounds
      ? books.filter((b) => b.nr >= bounds.lo && b.nr <= bounds.hi)
      : books;
    if (!f) return inBounds;
    return inBounds.filter(
      (b) =>
        b.name_en.toLowerCase().includes(f) ||
        b.name_tl.toLowerCase().includes(f) ||
        b.abbr.toLowerCase().includes(f),
    );
  }, [books, bounds, filter]);

  const openMeta = books?.find((b) => b.nr === openBook) ?? null;

  return (
    <Sheet open={open} onClose={onClose} title={openMeta ? nameIn(openMeta, bookLang) : "Books"} full>
      {!books ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : openMeta ? (
        <div>
          <div className="grid grid-cols-5 gap-2 pb-2">
            {Array.from({ length: openMeta.chapters }, (_, i) => i + 1).map((ch) => (
              <button
                key={ch}
                onClick={() => onPick(openMeta, ch)}
                className={`press flex h-11 items-center justify-center rounded-lg text-[15px] font-medium ${
                  openBook === currentBook && currentChapter === ch
                    ? "bg-accent-grad text-accent-fg"
                    : "bg-surface2 text-fg"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="sticky top-0 z-10 -mx-4 mb-3 bg-surface px-4 pb-2">
            <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2.5">
              <Search size={16} className="text-muted" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a book…"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
            </div>
            {corpusNote && visibleBooks && visibleBooks.length < (books?.length ?? 0) ? (
              <p className="px-1 pb-1 pt-2 text-[11px] text-muted">{corpusNote}</p>
            ) : null}
          </div>
          {visibleBooks?.filter((b) => b.testament === "OT").length ? (
            <>
              <Section>Old Testament</Section>
              <BookList
                list={visibleBooks.filter((b) => b.testament === "OT")}
                currentBook={currentBook}
                bookLang={bookLang}
                otherLang={otherLang}
                onOpen={setOpenBook}
              />
            </>
          ) : null}
          {visibleBooks?.filter((b) => b.testament === "NT").length ? (
            <>
              <Section>New Testament</Section>
              <BookList
                list={visibleBooks.filter((b) => b.testament === "NT")}
                currentBook={currentBook}
                bookLang={bookLang}
                otherLang={otherLang}
                onOpen={setOpenBook}
              />
            </>
          ) : null}
          {visibleBooks && visibleBooks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No book matches “{filter}”.</p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

function Section({ children }: { children: string }) {
  return (
    <div className="px-1 pb-1.5 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  );
}

function BookList({
  list,
  currentBook,
  bookLang,
  otherLang,
  onOpen,
}: {
  list: BookMeta[];
  currentBook?: number;
  bookLang: BookNamesLang;
  otherLang: BookNamesLang;
  onOpen: (nr: number) => void;
}) {
  return (
    <div className="-mx-2">
      {list.map((b) => (
        <button
          key={b.nr}
          onClick={() => onOpen(b.nr)}
          className={`press flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px] ${
            b.nr === currentBook ? "font-semibold text-accent" : ""
          } hover:bg-surface2`}
        >
          <span className="min-w-0">
            {bookLang === "tl" ? b.name_tl || b.name_en : b.name_en}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
            {otherLang === "tl" ? b.name_tl || b.name_en : b.name_en}
            <ChevronRight size={16} />
          </span>
        </button>
      ))}
    </div>
  );
}
