import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Bookmark, Search as SearchIcon, Languages, Settings as SettingsIcon, Shuffle, Sparkles } from "lucide-react";
import {
  chapterVerses,
  openTranslation,
  persistedTranslationIds,
  type TranslationId,
} from "../../lib/bible";
import { getState, type LastRead } from "../../lib/userdata";
import { useSettings } from "../../app/settings-ctx";
import { useManifest } from "../../app/use-manifest";
import { navigate, readHash } from "../../app/router";
import { bookName, verseOfTheDayRef, verseOfTheDaySeed } from "../../lib/reference";
import { Spinner, TopBar } from "../../components/ui";
import { useStarterPack } from "./use-starter-pack";

export default function HomeScreen() {
  const { settings } = useSettings();
  const manifestState = useManifest();
  const starter = useStarterPack();


  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const [vod, setVod] = useState<{
    book: number;
    chapter: number;
    verse: number;
    text: string;
    translation: TranslationId;
    abbr?: string;
  } | null>(null);
  const [vodLoading, setVodLoading] = useState(true);
  const [vodError, setVodError] = useState(false);
  const [vodNeedsDownload, setVodNeedsDownload] = useState(false);

  useEffect(() => {
    getState<LastRead>("lastRead").then((lr) => setLastRead(lr ?? null));
  }, []);

  // Verse of the day — only from a translation already on the device, so a
  // card can never surprise-download 17 MB. Preference: current → KJV →
  // anything persisted, in manifest order.
  useEffect(() => {
    let alive = true;
    setVodLoading(true);
    setVodError(false);
    setVodNeedsDownload(false);
    setVod(null);
    (async () => {
      try {
        const manifest = manifestState?.manifest;
        if (!manifest) return;
        const persisted = await persistedTranslationIds();
        const order: TranslationId[] = [];
        if (persisted.has(settings.translation as TranslationId)) {
          order.push(settings.translation as TranslationId);
        }
        if (!order.includes("kjv") && persisted.has("kjv")) order.push("kjv");
        for (const t of manifest.translations) {
          if (persisted.has(t.id) && !order.includes(t.id)) order.push(t.id);
        }
        if (!alive) return;
        if (order.length === 0) {
          setVodNeedsDownload(true);
          setVodLoading(false);
          return;
        }
        const tr = order[0];
        const meta = manifest.translations.find((t) => t.id === tr);
        const [book, chapter, verse] = verseOfTheDayRef(meta?.books ?? 66);
        await openTranslation(tr, meta?.verses);
        const rows = await chapterVerses({
          translation: tr,
          bookNr: book,
          chapter,
          verse,
        });
        if (!alive) return;
        const row = rows[0];
        if (row) {
          setVod({ book, chapter, verse, text: row.text, translation: tr, abbr: meta?.abbr });
        } else {
          setVodError(true);
        }
      } catch {
        if (alive) setVodError(true);
      } finally {
        if (alive) setVodLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [settings.translation, manifestState?.manifest, starter.active]);

  return (
    <div>
      <TopBar
        title={
          <span className="flex items-center gap-2">
            <BookOpen size={18} className="text-accent" />
            Watchers Bible
          </span>
        }
        right={
          <IconButton2 label="Settings" onClick={() => navigate("#/settings")}>
            <SettingsIcon size={20} />
          </IconButton2>
        }
      />

      <main className="px-4 pb-28">
        {starter.active && starter.current ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface2 px-4 py-3">
            <Spinner className="h-4 w-4" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                Preparing the starter translations · {starter.current.toUpperCase()} (
                {(starter.loaded / 1e6).toFixed(1)} MB)
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${((starter.done + 0.5) / Math.max(1, starter.total)) * 100}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-muted">
              {starter.done + 1}/{starter.total}
            </span>
          </div>
        ) : null}

        <Section title="Continue reading">
          {lastRead ? (
            <button
              onClick={() =>
                navigate(readHash(lastRead.translation, lastRead.book, lastRead.chapter, lastRead.verse))
              }
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left active:opacity-80"
            >
              <span>
                <span className="block text-[15px] font-semibold">
                  {bookName(lastRead.book)} {lastRead.chapter}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {lastRead.verse ? `Verse ${lastRead.verse} · ` : ""}
                  {lastRead.translation.toUpperCase()}
                </span>
              </span>
              <span className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
                Resume
              </span>
            </button>
          ) : (
            <button
              onClick={() => navigate(readHash(settings.translation, 1, 1))}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left active:opacity-80"
            >
              <span>
                <span className="block text-[15px] font-semibold">Start reading</span>
                <span className="mt-0.5 block text-xs text-muted">Genesis 1 · free, offline</span>
              </span>
              <span className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
                Begin
              </span>
            </button>
          )}
        </Section>

        <Section title="Verse of the day">
          <button
            disabled={!vod}
            onClick={() =>
              vod && navigate(readHash(vod.translation, vod.book, vod.chapter, vod.verse))
            }
            className={`w-full rounded-2xl border border-border bg-surface p-4 text-left ${
              vod ? "active:opacity-80" : "opacity-90"
            }`}
          >
            <div className="flex items-center gap-2 pb-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <Sparkles size={14} />
              {vod
                ? `${bookName(vod.book)} ${vod.chapter}:${vod.verse} · ${vod.abbr ?? vod.translation.toUpperCase()} · #${verseOfTheDaySeed()}`
                : "Preparing…"}
            </div>
            {vod ? (
              <p className="reader-verse line-clamp-4">{vod.text}</p>
            ) : vodNeedsDownload ? (
              <p className="text-sm text-muted">
                Grab a translation under Translations and today's verse will appear here.
              </p>
            ) : vodError ? (
              <p className="text-sm text-muted">
                Could not load the verse text yet — download a translation in the Translations tab.
              </p>
            ) : vodLoading ? (
              <div className="flex py-2">
                <Spinner size="sm" />
              </div>
            ) : null}
          </button>
        </Section>

        <Section title="Explore">
          <div className="grid grid-cols-2 gap-3">
            <Tile
              icon={<SearchIcon size={20} />}
              label="Search the Bible"
              sub="Instant, on-device"
              onClick={() => navigate("#/search")}
            />
            <Tile
              icon={<Languages size={20} />}
              label="25 translations"
              sub="Download once, read offline"
              onClick={() => navigate("#/translations")}
            />
            <Tile
              icon={<Bookmark size={20} />}
              label="Your library"
              sub="Highlights, notes, bookmarks"
              onClick={() => navigate("#/library")}
            />
            <Tile
              icon={<Shuffle size={20} />}
              label="Random chapter"
              sub="Let the Word find you"
              onClick={() => {
                const m = manifestState;
                if (!m || m.books.length === 0) {
                  navigate(readHash(settings.translation, 1, 1));
                  return;
                }
                const book = m.books[Math.floor(Math.random() * m.books.length)];
                const ch = 1 + Math.floor(Math.random() * book.chapters);
                navigate(readHash(settings.translation, book.nr, ch));
              }}
            />
          </div>
        </Section>

        <p className="px-2 pt-8 text-center text-xs leading-relaxed text-muted">
          Watchers Bible is free for everyone. The Bible lives on your device — private, instant,
          and fully offline.
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-5">
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tile({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface p-4 text-left active:opacity-80"
    >
      <span className="text-accent">{icon}</span>
      <span className="mt-2 block text-sm font-semibold leading-tight">{label}</span>
      <span className="mt-1 block text-xs text-muted">{sub}</span>
    </button>
  );
}

function IconButton2({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full text-fg hover:bg-surface2"
    >
      {children}
    </button>
  );
}
