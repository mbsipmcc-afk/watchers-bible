import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "read"; translation?: string; book?: number; chapter?: number; verse?: number }
  | { name: "search"; q?: string }
  | { name: "library" }
  | { name: "translations" }
  | { name: "settings" };

export function navigate(path: string): void {
  if (location.hash === path) return;
  location.hash = path;
}

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "read") {
    const versePart = parts[4] && parts[4].startsWith("v") ? Number(parts[4].slice(1)) : undefined;
    return {
      name: "read",
      translation: parts[1],
      book: parts[2] ? Number(parts[2]) : undefined,
      chapter: parts[3] ? Number(parts[3]) : undefined,
      verse: Number.isFinite(versePart) ? versePart : undefined,
    };
  }
  if (parts[0] === "search") {
    const q = new URLSearchParams(query ?? "").get("q") ?? undefined;
    return { name: "search", q };
  }
  if (parts[0] === "library") return { name: "library" };
  if (parts[0] === "translations") return { name: "translations" };
  if (parts[0] === "settings") return { name: "settings" };
  return { name: "home" };
}

/* getSnapshot must be referentially stable: the parsed route is cached at
   module scope and refreshed exactly once per hashchange event. */
let snapshot: Route = parse();

const listeners = new Set<() => void>();

window.addEventListener("hashchange", () => {
  snapshot = parse();
  for (const cb of listeners) cb();
});

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function readHash(
  translation: string,
  book: number,
  chapter: number,
  verse?: number,
): string {
  return `#/read/${translation}/${book}/${chapter}${verse ? `/v${verse}` : ""}`;
}
