import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { BookMeta } from "../../lib/bible";
import { Sheet, Spinner } from "../../components/ui";

export function BookPicker({
  open,
  onClose,
  books,
  currentBook,
  currentChapter,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  books: BookMeta[] | null;
  currentBook?: number;
  currentChapter?: number;
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

  const groups = useMemo(() => {
    if (!books) return null;
    const f = filter.trim().toLowerCase();
    const match = f
      ? books.filter(
          (b) =>
            b.name_en.toLowerCase().includes(f) ||
            b.abbr.toLowerCase().includes(f) ||
            b.name_tl.toLowerCase().includes(f),
        )
      : books;
    return {
      ot: match.filter((b) => b.testament === "OT"),
      nt: match.filter((b) => b.testament === "NT"),
    };
  }, [books, filter]);

  const openMeta = books?.find((b) => b.nr === openBook) ?? null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={openMeta ? openMeta.name_en : "Books"}
      full
    >
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
                className={`flex h-11 items-center justify-center rounded-lg text-[15px] font-medium ${
                  openBook === currentBook && currentChapter === ch
                    ? "bg-accent text-accent-fg"
                    : "bg-surface2 text-fg active:opacity-70"
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
          </div>
          {groups?.ot.length ? (
            <>
              <Section>Old Testament</Section>
              <BookList list={groups.ot} currentBook={currentBook} onOpen={setOpenBook} />
            </>
          ) : null}
          {groups?.nt.length ? (
            <>
              <Section>New Testament</Section>
              <BookList list={groups.nt} currentBook={currentBook} onOpen={setOpenBook} />
            </>
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
  onOpen,
}: {
  list: BookMeta[];
  currentBook?: number;
  onOpen: (nr: number) => void;
}) {
  return (
    <div className="-mx-2">
      {list.map((b) => (
        <button
          key={b.nr}
          onClick={() => onOpen(b.nr)}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px] ${
            b.nr === currentBook ? "font-semibold text-accent" : ""
          } hover:bg-surface2`}
        >
          {b.name_en}
          <ChevronRight size={16} className="text-muted" />
        </button>
      ))}
    </div>
  );
}
