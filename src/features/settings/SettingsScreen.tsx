import { useEffect, useState } from "react";
import { Moon, Sun, Sunrise, Trash2 } from "lucide-react";
import {
  loadManifest,
  persistedTranslationIds,
  resetLibrary,
  type BibleManifest,
} from "../../lib/bible";
import { useSettings } from "../../app/settings-ctx";
import type { ThemeName } from "../../lib/settings";
import { SectionTitle, TopBar } from "../../components/ui";

const THEMES: { key: ThemeName; label: string; icon: typeof Sun; swatch: string }[] = [
  {
    key: "light",
    label: "Day",
    icon: Sun,
    swatch: "linear-gradient(135deg, #faf7f1 0%, #f4d8b8 45%, #4e42d8 100%)",
  },
  {
    key: "sepia",
    label: "Sepia",
    icon: Sunrise,
    swatch: "linear-gradient(135deg, #f3e9d2 0%, #d98e4a 55%, #9a6b2f 100%)",
  },
  {
    key: "dark",
    label: "Night",
    icon: Moon,
    swatch: "linear-gradient(135deg, #0d0d17 0%, #8b7cff 55%, #34d399 100%)",
  },
];

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [persistedIds, setPersistedIds] = useState<Set<string>>(new Set());
  const [storage, setStorage] = useState<{
    usageMB: number;
    persistent: boolean | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    loadManifest()
      .then((m) => alive && setManifest(m))
      .catch(() => undefined);
    persistedTranslationIds().then((ids) => {
      if (alive) setPersistedIds(ids);
    });
    (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        let persistent: boolean | null = null;
        try {
          persistent = (await navigator.storage?.persisted?.()) ?? null;
        } catch {
          persistent = null;
        }
        if (alive) {
          setStorage({
            usageMB: Math.round((est?.usage ?? 0) / 1e6),
            persistent,
          });
        }
      } catch {
        /* estimate unsupported */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onDeviceMB =
    manifest?.translations
      .filter((t) => persistedIds.has(t.id))
      .reduce((sum, t) => sum + t.bytes, 0) ?? 0;
  const persistedCount = manifest
    ? manifest.translations.filter((t) => persistedIds.has(t.id)).length
    : 0;

  const wipeAll = async () => {
    if (confirm("Remove every downloaded translation from this device?")) {
      await resetLibrary();
      setPersistedIds(new Set());
    }
  };

  return (
    <div>
      <TopBar title="Settings" />
      <main className="px-4 pb-28">
        <SectionTitle>Appearance</SectionTitle>
        <div className="flex gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = settings.theme === t.key;
            return (
              <button
                key={t.key}
                onClick={() => update({ theme: t.key })}
                className={`press flex flex-1 flex-col items-center gap-2 rounded-xl border py-3 text-xs font-medium ${
                  active ? "border-accent bg-surface2 text-accent" : "border-border text-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-6 rounded-full border border-black/10"
                  style={{ background: t.swatch }}
                />
                <span className="flex items-center gap-1">
                  <Icon size={13} />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {manifest ? (
          <>
            <SectionTitle>Default translation</SectionTitle>
            <select
              value={settings.translation}
              onChange={(e) => update({ translation: e.target.value })}
              className="h-11 w-full rounded-xl bg-surface2 px-3 text-[15px] outline-none"
            >
              {manifest.translations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.abbr})
                </option>
              ))}
            </select>
          </>
        ) : null}

        <SectionTitle>Reading display</SectionTitle>
        <p className="px-1 text-sm leading-relaxed text-muted">
          Text size, typeface and line spacing are adjusted in the reader — open any Bible chapter
          and tap the sliders icon.
        </p>

        <SectionTitle>Data & storage</SectionTitle>
        <div className="g-border rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Bibles on this device</span>
            <span className="font-medium">
              {persistedCount} · {(onDeviceMB / 1e6).toFixed(0)} MB
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Total app storage used</span>
            <span className="font-medium">{storage ? `${storage.usageMB} MB` : "—"}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Persistent storage</span>
            <span className="font-medium">
              {storage === null
                ? "—"
                : storage.persistent
                  ? "On"
                  : "Off (downloads can be evicted)"}
            </span>
          </div>
        </div>
        <button
          onClick={wipeAll}
          className="mt-3 flex w-full items-center gap-2 rounded-xl border border-border px-4 py-3 text-left text-sm text-fg active:opacity-70"
        >
          <Trash2 size={16} className="text-muted" />
          Remove all downloaded translations
        </button>
        <p className="px-1 pt-2 text-xs leading-relaxed text-muted">
          Your highlights, notes and bookmarks are never removed by this — they live separately and
          privately on this device.
        </p>

        <SectionTitle>About</SectionTitle>
        <p className="px-1 text-sm leading-relaxed text-muted">
          Watchers Bible — free for all. 25 public-domain and freely licensed Bible translations in
          12 languages, instant full-text search, highlights, bookmarks and notes. Everything runs
          on your device: no account, no tracking, fully offline.
        </p>
        <p className="px-1 pt-2 text-xs text-muted">Version 1.0</p>
      </main>
    </div>
  );
}
