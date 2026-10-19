import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

/* ── Top bar ─────────────────────────────────────────────────────────────── */

export function TopBar({
  left,
  title,
  right,
  onClickTitle,
}: {
  left?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  onClickTitle?: () => void;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-1 border-b border-border px-1.5">
        <div className="flex min-w-9 items-center">{left}</div>
        <div
          className={`flex min-w-0 flex-1 items-center ${onClickTitle ? "cursor-pointer" : ""}`}
          onClick={onClickTitle}
        >
          <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">
            {title}
          </div>
        </div>
        <div className="flex min-w-9 items-center justify-end">{right}</div>
      </div>
    </header>
  );
}

/* ── Icon button ─────────────────────────────────────────────────────────── */

export function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        active ? "text-accent" : "text-fg hover:bg-surface2"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Bottom sheet ────────────────────────────────────────────────────────── */

export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col rounded-t-2xl bg-surface shadow-2xl ${
          full ? "top-6" : "max-h-[75vh]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[15px] font-semibold">{title}</div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface2"
          >
            <X size={18} />
          </button>
        </div>
        <div className="safe-bottom min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */

export function Spinner({ size = "md", className = "" }: { size?: "sm" | "md"; className?: string }) {
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div
      className={`inline-block ${dim} animate-spin rounded-full border-2 border-border border-t-accent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center text-muted">
      {icon}
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────────────── */

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pb-2 pt-5 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}
