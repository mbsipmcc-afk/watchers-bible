import { useCallback, useEffect, useState } from "react";
import { Check, CloudDownload, Trash2 } from "lucide-react";
import {
  deleteTranslation,
  loadManifest,
  persistedTranslationIds,
  translationLangName,
  type BibleManifest,
  type TranslationId,
} from "../../lib/bible";
import { downloadAndInstall } from "../../lib/downloader";
import { useSettings } from "../../app/settings-ctx";
import { EmptyState, Spinner, TopBar } from "../../components/ui";

type ItemState =
  | { phase: "downloading"; loaded: number; total: number | null }
  | { phase: "importing" };

export default function TranslationsScreen() {
  const { settings, update } = useSettings();
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [persistedIds, setPersistedIds] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Map<string, ItemState>>(new Map());
  const [globalError, setGlobalError] = useState<string | null>(null);

  const refreshPersisted = useCallback(async () => {
    setPersistedIds(await persistedTranslationIds());
  }, []);

  useEffect(() => {
    let alive = true;
    loadManifest()
      .then((m) => alive && setManifest(m))
      .catch(() => undefined);
    refreshPersisted();
    return () => {
      alive = false;
    };
  }, [refreshPersisted]);

  const busyId = [...states.keys()][0];

  const setStateOf = (id: string, s: ItemState | undefined) => {
    setStates((prev) => {
      const next = new Map(prev);
      if (s) next.set(id, s);
      else next.delete(id);
      return next;
    });
  };

  const download = async (id: string) => {
    if (busyId) return; // strictly sequential: corpora are 7–17 MB apiece
    setGlobalError(null);
    try {
      setStateOf(id, { phase: "downloading", loaded: 0, total: null });
      await downloadAndInstall(id as TranslationId, (loaded, total) => {
        setStateOf(id, { phase: "downloading", loaded, total: total ?? null });
      });
      await refreshPersisted();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : String(e));
    } finally {
      setStateOf(id, undefined);
    }
  };

  const remove = async (id: string) => {
    const name = manifest?.translations.find((t) => t.id === id)?.name;
    if (id === settings.translation) {
      const ok = confirm(
        `${name ?? "This translation"} is the one you're currently reading. Remove it from this device? You can re-download it any time.`,
      );
      if (!ok) return;
    }
    await deleteTranslation(id as TranslationId);
    await refreshPersisted();
  };

  const list = manifest?.translations ?? [];
  const totalPersistedBytes = list
    .filter((t) => persistedIds.has(t.id))
    .reduce((sum, t) => sum + t.bytes, 0);

  return (
    <div>
      <TopBar title="Translations" />
      <main className="pb-28">
        {globalError ? (
          <div className="mx-4 mb-2 rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-fg">
            {globalError}
          </div>
        ) : null}

        {!manifest && states.size === 0 ? (
          <div className="flex justify-center pt-16">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <EmptyState text="Could not load the translation list. Check your connection and reload." />
        ) : (
          <ul>
            {list.map((t) => {
              const isCurrent = settings.translation === t.id;
              const isPersisted = persistedIds.has(t.id);
              const st = states.get(t.id);
              return (
                <li key={t.id} className="border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wide text-muted">
                      {t.abbr}
                    </span>
                    <button
                      onClick={() => update({ translation: t.id })}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block truncate text-[15px] font-medium ${
                          isCurrent ? "text-accent" : ""
                        }`}
                      >
                        {t.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {translationLangName(t.lang)} · {Math.round(t.bytes / 1e6)} MB ·{" "}
                        {t.books === 66
                          ? "66 books"
                          : t.books === 27
                            ? "New Testament"
                            : "Old Testament"}
                        {isPersisted ? " · on device" : ""}
                      </span>
                    </button>
                    {st?.phase === "downloading" || st?.phase === "importing" ? (
                      <Spinner size="sm" />
                    ) : isPersisted ? (
                      <>
                        <button
                          aria-label={`Remove ${t.abbr}`}
                          onClick={() => remove(t.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface2"
                        >
                          <Trash2 size={16} />
                        </button>
                        {isCurrent ? <Check size={18} className="text-accent" /> : null}
                      </>
                    ) : (
                      <button
                        aria-label={`Download ${t.abbr}`}
                        disabled={Boolean(busyId)}
                        onClick={() => download(t.id)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-surface2 ${
                          busyId ? "opacity-40" : ""
                        }`}
                      >
                        <CloudDownload size={18} />
                      </button>
                    )}
                  </div>
                  {st?.phase === "downloading" ? (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                        <div
                          className="h-full rounded-full bg-accent transition-[width]"
                          style={{
                            width: `${Math.min(100, (st.loaded / (st.total ?? t.bytes)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {(st.loaded / 1e6).toFixed(1)} MB
                        {st.total && st.total > st.loaded
                          ? ` of ${(st.total / 1e6).toFixed(1)} MB`
                          : " downloading…"}
                      </p>
                    </div>
                  ) : null}
                  {st?.phase === "importing" ? (
                    <p className="mt-2 text-[11px] text-muted">Storing on device…</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="px-4 pt-5 text-xs leading-relaxed text-muted">
          On this device: {(totalPersistedBytes / 1e6).toFixed(0)} MB of stored translations.
          Everything is free — download, read and search entirely offline.
        </p>
      </main>
    </div>
  );
}
