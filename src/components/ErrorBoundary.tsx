import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches render crashes so a bug can never turn into a white screen —
 * the user's Bibles, highlights and notes all live on-device and are
 * untouched by a UI error.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only — no tracking anywhere: the app is account-free.
    console.error("[Watchers Bible] render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <div
          aria-hidden="true"
          className="mb-1 h-16 w-16 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--aurora-a), transparent 72%), var(--c-surface2)",
          }}
        />
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          The app hit an unexpected error. Reloading usually fixes it — your translations,
          highlights, notes and bookmarks are safe on this device.
        </p>
        <button
          onClick={() => location.reload()}
          className="bg-accent-grad press mt-2 h-11 rounded-xl px-6 text-[15px] font-semibold text-accent-fg"
        >
          Reload Watchers Bible
        </button>
      </div>
    );
  }
}
