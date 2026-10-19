import { useEffect, useState } from "react";
import {
  persistedTranslationIds as persistedIds,
  type TranslationId,
} from "../../lib/bible";
import { downloadAndInstall } from "../../lib/downloader";

/**
 * First run: quietly fetch + install the starter translations — English
 * (KJV), Tagalog (ADB), Cebuano (CEB), Indonesian (TB) — in the background,
 * then ask the browser to make storage persistent so the Bibles can never be
 * evicted. Runs at most once per device; already-persisted ones are skipped.
 */

const STARTER: TranslationId[] = ["kjv", "adb", "ceb", "tb"];
const FLAG = "wb-starter-installed";

export type StarterStatus = {
  active: boolean;
  current: TranslationId | null;
  done: number;
  total: number;
  loaded: number;
};

let sessionRan = false;

export function useStarterPack(): StarterStatus {
  const [status, setStatus] = useState<StarterStatus>({
    active: false,
    current: null,
    done: 0,
    total: 0,
    loaded: 0,
  });

  useEffect(() => {
    if (sessionRan) return;
    sessionRan = true;
    try {
      if (localStorage.getItem(FLAG) === "1") return;
    } catch {
      /* storage unavailable: still try once this session */
    }

    let alive = true;
    (async () => {
      const has = await persistedIds();
      const todo = STARTER.filter((id) => !has.has(id));
      if (!alive) return;
      if (todo.length === 0) {
        try {
          localStorage.setItem(FLAG, "1");
        } catch {
          /* ignore */
        }
        return;
      }
      if (alive) {
        setStatus({ active: true, current: null, done: 0, total: todo.length, loaded: 0 });
      }
      for (let i = 0; i < todo.length; i += 1) {
        const id = todo[i];
        if (!alive) return;
        setStatus({ active: true, current: id, done: i, total: todo.length, loaded: 0 });
        try {
          await downloadAndInstall(id, (loaded) => {
            if (alive) {
              setStatus({ active: true, current: id, done: i, total: todo.length, loaded });
            }
          });
        } catch {
          /* offline or failed: skip — the user can download later in Translations */
          break;
        }
      }
      // Ask the browser to never evict the downloaded Bibles. Best-effort:
      // most browsers grant it for installed PWAs / with usage over time.
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* unsupported: non-fatal */
      }
      try {
        localStorage.setItem(FLAG, "1");
      } catch {
        /* ignore */
      }
      if (alive) {
        setStatus({
          active: false,
          current: null,
          done: todo.length,
          total: todo.length,
          loaded: 0,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return status;
}
