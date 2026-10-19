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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm leading-relaxed text-muted">
          The app hit an unexpected error. Reloading usually fixes it — your
          translations, highlights, notes and bookmarks are safe on this device.
        </p>
        <button
          onClick={() => location.reload()}
          className="mt-2 h-11 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-fg active:opacity-80"
        >
          Reload Watchers Bible
        </button>
      </div>
    );
  }
}
