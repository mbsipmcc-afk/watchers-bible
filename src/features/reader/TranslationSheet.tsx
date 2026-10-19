import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Sheet, Spinner } from "../../components/ui";
import {
  loadManifest,
  persistedTranslationIds,
  translationLangName,
  type BibleManifest,
  type TranslationId,
} from "../../lib/bible";

export function TranslationSheet({
  open,
  onClose,
  current,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  current: string;
  onPick: (id: TranslationId) => void;
}) {
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [persisted, setPersisted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadManifest()
      .then((m) => alive && setManifest(m))
      .catch(() => undefined);
    persistedTranslationIds().then((ids) => {
      if (alive) setPersisted(ids);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const list = manifest?.translations ?? [];

  return (
    <Sheet open={open} onClose={onClose} title="Translation">
      {!manifest ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="-mx-2">
          {list.map((t) => {
            const isCurrent = t.id === current;
            const isPersisted = persisted.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => {
                  onPick(t.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface2 ${
                  isCurrent ? "text-accent" : ""
                }`}
              >
                <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wide opacity-60">
                  {t.abbr}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px]">{t.name}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {translationLangName(t.lang)}
                </span>
                {isCurrent ? (
                  <Check size={16} aria-label="Current translation" />
                ) : isPersisted ? (
                  <Check
                    size={14}
                    className="text-muted"
                    aria-label="On device"
                  />
                ) : null}
              </button>
            );
          })}
          <div className="px-3 pb-1 pt-3 text-xs text-muted">
            Downloads & storage live in the Translations tab.
          </div>
        </div>
      )}
    </Sheet>
  );
}
