import { Moon, Sun, Sunrise, Type } from "lucide-react";
import { Sheet, SectionTitle } from "../../components/ui";
import { useSettings } from "../../app/settings-ctx";
import type { FontFamilyName, ThemeName } from "../../lib/settings";

const THEMES: { key: ThemeName; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Day", icon: Sun },
  { key: "sepia", label: "Sepia", icon: Sunrise },
  { key: "dark", label: "Night", icon: Moon },
];

const FONTS: { key: FontFamilyName; label: string }[] = [
  { key: "serif", label: "Serif" },
  { key: "sans", label: "Sans" },
];

const SPACINGS = [1.6, 1.75, 1.95];

export function ReaderSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, update } = useSettings();

  return (
    <Sheet open={open} onClose={onClose} title="Display">
      <SectionTitle>Theme</SectionTitle>
      <div className="flex gap-2">
        {THEMES.map((t) => {
          const Icon = t.icon;
          const active = settings.theme === t.key;
          return (
            <button
              key={t.key}
              onClick={() => update({ theme: t.key })}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium ${
                active
                  ? "border-accent bg-surface2 text-accent"
                  : "border-border text-muted"
              }`}
            >
              <Icon size={18} />
              {t.label}
            </button>
          );
        })}
      </div>

      <SectionTitle>Font</SectionTitle>
      <div className="flex gap-2">
        {FONTS.map((f) => (
          <button
            key={f.key}
            onClick={() => update({ fontFamily: f.key })}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-medium ${
              settings.fontFamily === f.key
                ? "border-accent bg-surface2 text-accent"
                : "border-border text-muted"
            }`}
          >
            <span className={f.key === "serif" ? "font-serif" : "font-sans"}>{f.label}</span>
          </button>
        ))}
      </div>

      <SectionTitle>Text size</SectionTitle>
      <div className="flex items-center gap-3">
        <button
          aria-label="Smaller text"
          onClick={() => update({ fontSize: Math.max(15, settings.fontSize - 2) })}
          className="h-10 flex-1 rounded-xl bg-surface2 text-lg font-medium"
        >
          A−
        </button>
        <span className="flex w-14 items-center justify-center gap-1 text-sm text-muted">
          <Type size={14} />
          {settings.fontSize}
        </span>
        <button
          aria-label="Larger text"
          onClick={() => update({ fontSize: Math.min(30, settings.fontSize + 2) })}
          className="h-10 flex-1 rounded-xl bg-surface2 text-lg font-semibold"
        >
          A+
        </button>
      </div>

      <SectionTitle>Line spacing</SectionTitle>
      <div className="flex gap-2">
        {SPACINGS.map((s) => (
          <button
            key={s}
            onClick={() => update({ lineHeight: s })}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-medium ${
              settings.lineHeight === s
                ? "border-accent bg-surface2 text-accent"
                : "border-border text-muted"
            }`}
          >
            {s === 1.6 ? "Tight" : s === 1.75 ? "Normal" : "Wide"}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
