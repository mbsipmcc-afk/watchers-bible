import { type ReactNode, useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
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
    <header className="safe-top glass sticky top-0 z-30 border-b border-border">
      <div className="flex h-14 items-center gap-1 px-1.5">
        <div className="flex min-w-9 items-center">{left}</div>
        <div
          className={`flex min-w-0 flex-1 items-center ${onClickTitle ? "cursor-pointer" : ""}`}
          onClick={onClickTitle}
        >
          <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold tracking-tight">
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
      className={`press flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        active ? "text-accent" : "text-fg hover:bg-surface2"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Bottom sheet — spring slide-up, scrim fade, focus-trapped dialog ────── */

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
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    // Focus the panel so TalkBack/VoiceOver & keyboards land inside the dialog.
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Minimal focus trap: cycle within the sheet.
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : "Dialog"}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col rounded-t-3xl border-t border-border bg-surface shadow-2xl outline-none ${
              full ? "top-6" : "max-h-[75vh]"
            }`}
          >
            <div className="flex justify-center pt-2.5">
              <div className="h-1 w-9 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2 pt-2">
              <div className="text-[15px] font-semibold tracking-tight">{title}</div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="press flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface2"
              >
                <X size={18} />
              </button>
            </div>
            <div className="safe-bottom min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
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

/* ── Shimmer skeleton row ────────────────────────────────────────────────── */

export function SkeletonRows({ rows = 4, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div className="space-y-3 pt-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2" style={{ opacity: 1 - i * 0.12 }}>
          <div className={`shimmer w-10 rounded ${tall ? "h-3" : "h-2.5"}`} />
          <div className={`shimmer rounded ${tall ? "h-4" : "h-3"}`} style={{ width: `${88 - i * 7}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="fade-up flex flex-col items-center gap-4 px-8 py-16 text-center text-muted">
      {icon ? (
        <div className="blob flex h-14 w-14 items-center justify-center text-accent">{icon}</div>
      ) : null}
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────────────── */

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pb-2 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </h2>
  );
}
