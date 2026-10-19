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

  const go = (key: string) => {
    if (key === "home") {
      navigate("#/");
    } else if (key === "read") {
      // Resume where the reader was actually left, not always Genesis 1.
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

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => go(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
