import { Bookmark, BookmarkCheck, Copy, Eraser, FileText, Share2, X } from "lucide-react";
import type { ReactNode } from "react";

const HL_COLORS = [1, 2, 3, 4, 5] as const;

/**
 * Floating action pill above the tab bar while verses are selected.
 * Highlight chips: color = apply, the eraser = clear highlights.
 */
export function VerseActionBar({
  count,
  allBookmarked,
  onHighlight,
  onClearHighlight,
  onBookmark,
  onNote,
  onCopy,
  onShare,
  onClearSelection,
}: {
  count: number;
  allBookmarked: boolean;
  onHighlight: (color: number) => void;
  onClearHighlight: () => void;
  onBookmark: () => void;
  onNote: () => void;
  onCopy: () => void;
  onShare: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[76px] z-30 mx-auto max-w-md px-3">
      <div className="pop-in flex flex-col gap-2 rounded-2xl border border-border glass p-2.5"
        style={{ boxShadow: "var(--shadow-dock)" }}>
        <div className="flex items-center justify-between gap-2">
          <span className="px-1 text-xs font-semibold text-muted">
            {count} verse{count > 1 ? "s" : ""} selected
          </span>
          <button
            aria-label="Clear selection"
            onClick={onClearSelection}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-surface2"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 pl-1">
            {HL_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Highlight ${c}`}
                onClick={() => onHighlight(c)}
                className={`hl-${c} h-8 w-8 rounded-full border border-black/10 active:scale-90 transition-transform`}
              />
            ))}
            <button
              aria-label="Remove highlight"
              onClick={onClearHighlight}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface2 active:scale-90"
            >
              <Eraser size={16} />
            </button>
          </div>
          <div className="flex items-center">
            <ActionBtn label={allBookmarked ? "Remove bookmark" : "Bookmark"} onClick={onBookmark}>
              {allBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </ActionBtn>
            <ActionBtn label="Note" onClick={onNote}>
              <FileText size={18} />
            </ActionBtn>
            <ActionBtn label="Copy" onClick={onCopy}>
              <Copy size={18} />
            </ActionBtn>
            <ActionBtn label="Share" onClick={onShare}>
              <Share2 size={18} />
            </ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full text-fg hover:bg-surface2 active:scale-90"
    >
      {children}
    </button>
  );
}
