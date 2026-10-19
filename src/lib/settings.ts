"use client";

/**
 * Reader + appearance settings, persisted in localStorage (tiny, synchronous,
 * needed before first paint to avoid theme flash).
 */

export type ThemeName = "light" | "sepia" | "dark";
export type FontFamilyName = "serif" | "sans";

export type BookNamesLang = "en" | "tl";

export type Settings = {
  theme: ThemeName;
  fontSize: number; // px, 15..30
  lineHeight: number; // 1.5..2.2
  fontFamily: FontFamilyName;
  translation: string; // active translation id
  dropCap: boolean; // gold drop-cap on the chapter's first letter
  bookNames: BookNamesLang; // display language for book names
};

const KEY = "wb-settings";

const DEFAULTS: Settings = {
  theme: "light",
  fontSize: 17,
  lineHeight: 1.75,
  fontFamily: "serif",
  translation: "kjv",
  dropCap: false,
  bookNames: "en",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(next: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: settings are session-only */
  }
}

const THEME_COLOR: Record<ThemeName, string> = {
  light: "#faf7f1",
  sepia: "#f3e9d2",
  dark: "#0d0d17",
};

/** Apply settings to the document (theme attr, reader CSS vars, meta color). */
export function applySettings(s: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.style.setProperty("--reader-font-size", `${s.fontSize}px`);
  root.style.setProperty("--reader-line-height", String(s.lineHeight));
  root.style.setProperty(
    "--reader-font-family",
    s.fontFamily === "sans"
      ? '"Inter Variable", system-ui, sans-serif'
      : '"Literata Variable", Georgia, serif',
  );
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.setAttribute("content", THEME_COLOR[s.theme]);
  }
}
