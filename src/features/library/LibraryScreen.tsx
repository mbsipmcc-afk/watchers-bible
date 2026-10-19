import { useState, type ReactNode } from "react";
import { Bookmark as BookmarkIcon, FileText as FileTextIcon, Highlighter } from "lucide-react";
import { navigate, readHash } from "../../app/router";
import { useSettings } from "../../app/settings-ctx";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/userdata";
import { bookName } from "../../lib/reference";
import { EmptyState, TopBar } from "../../components/ui";

type Tab = "highlights" | "bookmarks" | "notes";

const TABS: { key: Tab; label: string; icon: typeof BookmarkIcon }[] = [
  { key: "highlights", label: "Highlights", icon: Highlighter },
  { key: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { key: "notes", label: "Notes", icon: FileTextIcon },
];

export default function LibraryScreen() {
  const [tab, setTab] = useState<Tab>("highlights");
  const { settings } = useSettings();

  const highlights = useLiveQuery(
    () => db.highlights.orderBy("updatedAt").reverse().limit(300).toArray(),
    [],
  );
  const bookmarks = useLiveQuery(
    () => db.bookmarks.orderBy("createdAt").reverse().limit(300).toArray(),
    [],
  );
  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().limit(300).toArray(), []);

  const data =
    tab === "highlights"
      ? highlights
      : tab === "bookmarks"
        ? bookmarks
        : notes;

  if (data == null) {
    return null;
  }

  const open = (translation: string, book: number, chapter: number, verse?: number) =>
    navigate(readHash(translation, book, chapter, verse));

  return (
    <div>
      <TopBar title="Library" />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md px-4 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium ${
                  active ? "bg-surface2 text-accent" : "text-muted"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="pb-28">
        {data == null ? null : data.length === 0 ? (
          <EmptyState
            icon={
              tab === "notes" ? (
                <FileTextIcon size={22} />
              ) : tab === "bookmarks" ? (
                <BookmarkIcon size={22} />
              ) : (
                <Highlighter size={22} />
              )
            }
            text={
              tab === "notes"
                ? "Notes you write on verses will appear here."
                : tab === "bookmarks"
                  ? "Bookmark verses while reading and they'll be saved here."
                  : "Tap a verse while reading and pick a highlight color."
            }
          />
        ) : tab === "highlights" ? (
          <ul>
            {(highlights ?? []).map((h, i) => (
              <li key={`${h.translation}-${h.book}-${h.chapter}-${h.verse}-${i}`}>
                <RowButton
                  onClick={() => open(h.translation, h.book, h.chapter, h.verse)}
                  leading={
                    <span
                      className={`hl-${h.color ?? 1} inline-block h-4 w-4 shrink-0 rounded-full border border-black/10`}
                    />
                  }
                  title={`${bookName(h.book)} ${h.chapter}:${h.verse}`}
                  sub={h.translation.toUpperCase()}
                />
              </li>
            ))}
          </ul>
        ) : tab === "bookmarks" ? (
          <ul>
            {(bookmarks ?? []).map((b, i) => (
              <li key={`${b.translation}-${b.book}-${b.chapter}-${b.verse}-${i}`}>
                <RowButton
                  onClick={() => open(b.translation, b.book, b.chapter, b.verse)}
                  leading={
                    <BookmarkIcon size={16} className="shrink-0 text-accent" />
                  }
                  title={`${bookName(b.book)} ${b.chapter}:${b.verse}`}
                  sub={b.translation.toUpperCase()}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul>
            {(notes ?? [])
              .filter((n) => n.body)
              .map((n) => (
                <li key={n.id}>
                  <RowButton
                    onClick={() => open(n.translation, n.book, n.chapter, n.verse)}
                    leading={
                      <FileTextIcon size={16} className="shrink-0 text-accent" />
                    }
                    title={`${bookName(n.book)} ${n.chapter}:${n.verse}`}
                    sub={n.body}
                  />
                </li>
              ))}
          </ul>
        )}

        {data && data.length > 0 ? (
          <p className="px-4 pt-6 text-center text-xs text-muted">
            Stored privately on this device · default reading translation{" "}
            {settings.translation.toUpperCase()}
          </p>
        ) : null}
      </main>
    </div>
  );
}

function RowButton({
  onClick,
  leading,
  title,
  sub,
}: {
  onClick: () => void;
  leading?: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left active:bg-surface2"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{sub}</span>
      </span>
    </button>
  );
}
