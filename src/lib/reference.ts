import type { BookMeta } from "./bible";

/**
 * Reference helpers: synchronous canonical book names (the manifest is the
 * source of truth, but share/copy text should never wait on it), and the
 * verse-of-the-day curation.
 */

const BOOK_NAMES: string[] = [
  "",
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
  "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
  "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
  "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah",
  "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
  "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
];

const BOOK_SHORTS = [
  "",
  "Gen", "Exo", "Lev", "Num", "Deu", "Jos", "Jdg", "Rut", "1Sa", "2Sa",
  "1Ki", "2Ki", "1Ch", "2Ch", "Ezr", "Neh", "Est", "Job", "Psa", "Pro",
  "Ecc", "Sng", "Isa", "Jer", "Lam", "Eze", "Dan", "Hos", "Joe", "Amo",
  "Oba", "Jon", "Mic", "Nah", "Hab", "Zep", "Hag", "Zec", "Mal", "Mat",
  "Mar", "Luk", "Joh", "Act", "Rom", "1Co", "2Co", "Gal", "Eph", "Php",
  "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jas", "1Pe",
  "2Pe", "1Jo", "2Jo", "3Jo", "Jud", "Rev",
];

export function bookName(nr: number): string {
  return BOOK_NAMES[nr] ?? `Book ${nr}`;
}

/**
 * Display name for a book honoring the book-names setting. Uses the
 * manifest's per-translation `name_tl` when available, falls back to the
 * built-in English canon for zero-manifest contexts (e.g. share text).
 */
export function bookLabel(
  nr: number,
  lang: "en" | "tl",
  metas?: BookMeta[] | null,
): string {
  const meta = metas?.find((b) => b.nr === nr);
  if (meta) return lang === "tl" ? meta.name_tl || meta.name_en : meta.name_en;
  return bookName(nr);
}

export function bookShort(nr: number): string {
  return BOOK_SHORTS[nr] ?? String(nr);
}

/** "Genesis 3" / "John 3:16" */
export function fmtRef(book: number, chapter: number, verse?: number | null): string {
  return verse ? `${bookName(book)} ${chapter}:${verse}` : `${bookName(book)} ${chapter}`;
}

export function bookMetaFromManifest(metas: BookMeta[], nr: number): BookMeta | undefined {
  return metas.find((b) => b.nr === nr);
}

/**
 * Verse-of-the-day curation — well-known references as [book, chapter, verse],
 * in canonical 66-book numbering. The day-of-epoch picks an entry; a
 * translation that lacks the book (NT-only TR/TSG, OT-only WLC) shifts the
 * index instead of failing.
 */
export const VERSE_OF_DAY_REFS: [number, number, number][] = [
  [43, 3, 16], [19, 23, 1], [50, 4, 13], [20, 3, 5], [24, 29, 11], [45, 8, 28],
  [40, 6, 33], [23, 41, 10], [6, 1, 9], [1, 1, 1], [19, 119, 105], [46, 13, 4],
  [49, 2, 8], [48, 5, 22], [40, 5, 16], [19, 46, 1], [20, 16, 3], [23, 40, 31],
  [40, 11, 28], [45, 12, 2], [19, 27, 1], [59, 1, 5], [19, 91, 1], [51, 3, 23],
  [55, 1, 7], [58, 11, 1], [19, 37, 4], [43, 14, 27], [60, 5, 7], [36, 3, 17],
  [19, 121, 1], [47, 5, 17], [45, 15, 13], [58, 4, 16], [62, 1, 9], [19, 34, 8],
  [43, 15, 5], [48, 2, 20], [33, 6, 8], [25, 3, 22], [35, 3, 19], [19, 139, 14],
  [40, 11, 29], [59, 1, 22], [52, 5, 16], [49, 4, 32], [60, 3, 9], [19, 62, 8],
  [23, 53, 5], [44, 4, 31], [19, 73, 26], [66, 21, 4], [58, 12, 2], [40, 28, 20],
  [19, 23, 6], [19, 23, 4], [54, 4, 12], [45, 6, 23], [24, 33, 3], [19, 118, 24],
  [43, 16, 33], [50, 4, 6], [51, 2, 7], [46, 15, 58], [19, 127, 1], [30, 5, 24],
  [25, 3, 23], [19, 34, 18], [61, 3, 9], [19, 46, 10],
];

export function verseOfTheDayRef(translationBooks: number): [number, number, number] {
  const day = Math.floor(Date.now() / 86_400_000);
  let idx = day % VERSE_OF_DAY_REFS.length;
  for (let i = 0; i < VERSE_OF_DAY_REFS.length; i += 1) {
    const [book] = VERSE_OF_DAY_REFS[(idx + i) % VERSE_OF_DAY_REFS.length];
    if (book <= translationBooks) {
      idx = (idx + i) % VERSE_OF_DAY_REFS.length;
      return VERSE_OF_DAY_REFS[idx];
    }
  }
  return VERSE_OF_DAY_REFS[idx];
}

export function verseOfTheDaySeed(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/** Contiguous runs of verse numbers, e.g. [3,4,5,7] → [[3,5],[7,7]]. Dedupes input. */
export function groupVerses(verses: number[]): [number, number][] {
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const groups: [number, number][] = [];
  for (const v of sorted) {
    const last = groups[groups.length - 1];
    if (last && v === last[1] + 1) {
      last[1] = v;
    } else {
      groups.push([v, v]);
    }
  }
  return groups;
}

/**
 * Full share/copy text. `selected` limits the body to tapped verses and
 * groups them into ranges ("Genesis 1:1-3, 5"); without it every passed row
 * is included. `displayBook` overrides the canonical English book name.
 */
export function fmtShareText(
  book: number,
  chapter: number,
  translationAbbr: string | undefined,
  rows: { verse: number; text: string }[],
  selected?: number[],
  displayBook?: string,
): string {
  const chosen = selected
    ? rows.filter((r) => selected.includes(r.verse))
    : rows;
  if (chosen.length === 0) return "";
  const groups = groupVerses(chosen.map((v) => v.verse));
  const ref =
    groups.length === 1 && groups[0][0] === groups[0][1]
      ? `${chapter}:${groups[0][0]}`
      : groups.map(([a, b]) => (a === b ? `${chapter}:${a}` : `${chapter}:${a}-${b}`)).join(", ");
  const abbr = translationAbbr ? ` (${translationAbbr})` : "";
  const lines = chosen.map((v) => `${v.verse} ${v.text}`).join("\n");
  return `${displayBook ?? bookName(book)} ${ref}${abbr}\n${lines}\n\nvia Watchers Bible`;
}
