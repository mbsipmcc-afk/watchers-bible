import { useEffect, useState } from "react";
import { Moon, Sun, Sunrise, Trash2 } from "lucide-react";
import {
  loadManifest,
  persistedTranslationIds,
  resetLibrary,
  type BibleManifest,
} from "../../lib/bible";
import { db } from "../../lib/userdata";
import { LICENSES, LICENSE_CATEGORY_LABEL } from "../../lib/licenses";
import { useSettings } from "../../app/settings-ctx";
import type { ThemeName } from "../../lib/settings";
import { SectionTitle, Sheet, TopBar } from "../../components/ui";

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
  const [credits, setCredits] = useState(false);

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
      const res = await resetLibrary();
      setPersistedIds(new Set());
      setStorage((s) => (s ? { ...s, usageMB: Math.max(0, s.usageMB - Math.round(onDeviceMB / 1e6)) } : s));
      void res;
    }
  };

  const backup = async () => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        app: "watchers-bible",
        notes: await db.notes.toArray(),
        highlights: await db.highlights.toArray(),
        bookmarks: await db.bookmarks.toArray(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchers-bible-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      /* export failed silently */
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

        <SectionTitle>Book names</SectionTitle>
        <div className="flex gap-2">
          {(
            [
              { key: "en", label: "English" },
              { key: "tl", label: "Tagalog" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => update({ bookNames: o.key })}
              className={`press flex-1 rounded-xl border py-2.5 text-sm font-medium ${
                settings.bookNames === o.key
                  ? "border-accent bg-surface2 text-accent"
                  : "border-border text-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="px-1 pt-2 text-xs text-muted">
          Chip captions in the book picker always show the other language as a hint.
        </p>

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
          onClick={backup}
          className="press mt-3 flex w-full items-center gap-2 rounded-xl border border-border px-4 py-3 text-left text-sm text-fg"
        >
          <span className="bg-accent-grad h-8 w-8 items-center justify-center rounded-lg text-accent-fg flex text-xs font-bold">
            ↓
          </span>
          <span>
            <span className="block font-medium">Backup my study data</span>
            <span className="block text-xs text-muted">
              Downloads notes, highlights and bookmarks as JSON
            </span>
          </span>
        </button>
        <button
          onClick={wipeAll}
          className="press mt-3 flex w-full items-center gap-2 rounded-xl border border-border px-4 py-3 text-left text-sm text-fg"
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
        <button
          onClick={() => setCredits(true)}
          className="press mt-3 w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium text-fg"
        >
          About the translations · rights & credits →
        </button>
        <p className="px-1 pt-2 text-xs text-muted">Version 1.0.2</p>
      </main>

      <Sheet open={credits} onClose={() => setCredits(false)} title="Translations · rights & credits" full>
        <p className="pb-3 text-xs leading-relaxed text-muted">
          Draft summary — verify each line with the publisher before any commercial distribution or
          store publication.
        </p>
        <ul className="space-y-2.5">
          {(manifest?.translations ?? []).map((t) => {
            const lic = LICENSES[t.id as keyof typeof LICENSES];
            return (
              <li key={t.id} className="rounded-xl border border-border bg-surface2/60 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">
                    {t.name} <span className="text-muted">({t.abbr})</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      lic?.category === "pd"
                        ? "text-green-700"
                        : lic?.category === "free"
                          ? "text-accent"
                          : "text-gold"
                    }`}
                  >
                    {lic ? LICENSE_CATEGORY_LABEL[lic.category] : "Verify"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {lic?.line ?? "Status unknown — verify with the publisher."}
                </p>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
