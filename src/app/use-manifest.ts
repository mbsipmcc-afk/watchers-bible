import { useEffect, useState } from "react";
import { loadManifest, manifestBooks, type BibleManifest, type BookMeta } from "../lib/bible";

export type ManifestState = {
  manifest: BibleManifest;
  books: BookMeta[];
};

const cache: ManifestState[] = [];

/**
 * Loads /bible/manifest.json once (the module cache in bible.ts dedupes the
 * fetch) and exposes it as React state. Null while loading.
 */
export function useManifest(): ManifestState | null {
  const [state, setState] = useState<ManifestState | null>(cache[0] ?? null);

  useEffect(() => {
    if (state) return;
    let alive = true;
    loadManifest()
      .then((m) => {
        const next: ManifestState = { manifest: m, books: manifestBooks(m) };
        cache[0] = next;
        if (alive) setState(next);
      })
      .catch(() => {
        /* manifest failure surfaces per-screen; not fatal to the shell */
      });
    return () => {
      alive = false;
    };
  }, [state]);

  return state;
}
