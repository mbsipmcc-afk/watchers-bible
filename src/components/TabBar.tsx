import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { BookOpen, House, Bookmark, Search as SearchIcon, Settings } from "lucide-react";
import { useRoute, navigate, readHash } from "../app/router";
import { useSettings } from "../app/settings-ctx";
import { readLastReadSync } from "../lib/userdata";

const TABS = [
  { key: "home", label: "Home", icon: House },
  { key: "read", label: "Bible", icon: BookOpen },
  { key: "search", label: "Search", icon: SearchIcon },
  { key: "library", label: "Library", icon: Bookmark },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

export function TabBar() {
  const route = useRoute();
  const { settings } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  const go = (key: string) => {
    if (key === "home") {
      navigate("#/");
    } else if (key === "read") {
      const lr = readLastReadSync();
      navigate(
        lr
          ? readHash(lr.translation, lr.book, lr.chapter, lr.verse)
          : readHash(settings.translation, 1, 1),
      );
    } else {
      navigate(`#/${key}`);
    }
  };

  const active =
    route.name === "read"
      ? "read"
      : route.name === "search"
        ? "search"
        : route.name === "library"
          ? "library"
          : route.name === "settings"
            ? "settings"
            : "home";

  const measure = () => {
    const el = btnRefs.current[active];
    const box = containerRef.current;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    setPill({ x: r.left - b.left, w: r.width });
  };

  useLayoutEffect(measure, [active]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      <div
        ref={containerRef}
        className="glass relative mx-auto flex max-w-md items-stretch rounded-[26px] border border-border p-1.5"
        style={{ boxShadow: "var(--shadow-dock)" }}
      >
        {pill ? (
          <m.div
            className="pointer-events-none absolute bottom-1.5 top-1.5 rounded-[20px] border border-border"
            style={{
              background:
                "linear-gradient(135deg, var(--c-verse-sel), transparent 120%)",
            }}
            initial={false}
            animate={{ x: pill.x, width: pill.w }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        ) : null}
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          const showLabel = isActive;
          return (
            <button
              key={t.key}
              ref={(el) => {
                btnRefs.current[t.key] = el;
              }}
              aria-label={t.label}
              onClick={() => go(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative z-10 flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[20px] py-2 text-[10px] font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`}
            >
              <AnimatePresence initial={false}>
                {showLabel ? (
                  <m.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden whitespace-nowrap text-[10px] font-semibold"
                  >
                    {t.label}
                  </m.span>
                ) : null}
              </AnimatePresence>
              <m.span
                animate={{ scale: isActive ? 1.12 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                className="flex items-center"
              >
                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
              </m.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
