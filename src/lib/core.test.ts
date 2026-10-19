import { describe, expect, it } from "vitest";
import { groupVerses, fmtShareText, bookLabel, bookName } from "./reference";
import { normalizePersistedNames } from "./bible";
import { manifestBooks, type BibleManifest } from "./bible";
import { verseOfTheDayRef, VERSE_OF_DAY_REFS } from "./reference";

const MANIFEST: BibleManifest = {
  generatedAt: "test",
  books: [
    [1, "Gen", "Genesis", "Genesis", 50, "OT"],
    [19, "Psa", "Psalms", "Mga Awit", 150, "OT"],
    [23, "Isa", "Isaiah", "Isaias", 66, "OT"],
    [43, "Joh", "John", "Juan", 21, "NT"],
  ],
  translations: [],
};

const METAS = manifestBooks(MANIFEST);

describe("groupVerses", () => {
  it("groups contiguous runs and sorts unsorted input", () => {
    expect(groupVerses([7, 3, 4, 5])).toEqual([
      [3, 5],
      [7, 7],
    ]);
  });
  it("handles single verses, duplicates and empty input", () => {
    expect(groupVerses([2, 2, 9])).toEqual([
      [2, 2],
      [9, 9],
    ]);
    expect(groupVerses([])).toEqual([]);
  });
});

describe("fmtShareText", () => {
  const rows = [
    { verse: 1, text: "alpha" },
    { verse: 2, text: "beta" },
    { verse: 3, text: "gamma" },
  ];
  it("produces grouped refs and filters by selection", () => {
    const out = fmtShareText(1, 1, "KJV", rows, [1, 3], "Genesis");
    expect(out).toContain("Genesis 1:1, 1:3 (KJV)");
    expect(out).toContain("1 alpha");
    expect(out).toContain("3 gamma");
    expect(out).not.toContain("beta");
  });
  it("includes all rows when no selection and uses displayBook", () => {
    const out = fmtShareText(1, 1, undefined, rows, undefined, "Mga Awit");
    expect(out).toContain("Mga Awit 1:1-3");
  });
  it("returns empty for empty selection", () => {
    expect(fmtShareText(1, 1, "KJV", rows, [])).toBe("");
  });
});

describe("normalizePersistedNames", () => {
  it("strips leading slashes, prefix and extension", () => {
    expect(normalizePersistedNames(["/bible-kjv.sqlite3", "bible-adb.sqlite3", ""])).toEqual([
      "kjv",
      "adb",
    ]);
  });
  it("drops the wildcard reset marker", () => {
    expect(normalizePersistedNames(["*"])).toEqual([]);
  });
});

describe("manifestBooks", () => {
  it("maps compact tuples to objects", () => {
    const m = manifestBooks(MANIFEST);
    expect(m[1]).toEqual({
      nr: 19,
      abbr: "Psa",
      name_en: "Psalms",
      name_tl: "Mga Awit",
      chapters: 150,
      testament: "OT",
    });
  });
});

describe("verseOfTheDayRef", () => {
  it("never returns a book beyond the corpus", () => {
    for (const books of [27, 39, 66]) {
      for (let day = 0; day < 400; day += 7) {
        const realNow = Date.now;
        Date.now = () => day * 86_400_000;
        const [book] = verseOfTheDayRef(books);
        Date.now = realNow;
        expect(book).toBeLessThanOrEqual(books);
      }
    }
  });
  it("curates valid canonical refs", () => {
    for (const [book, chapter, verse] of VERSE_OF_DAY_REFS) {
      expect(book).toBeGreaterThanOrEqual(1);
      expect(book).toBeLessThanOrEqual(66);
      expect(chapter).toBeGreaterThan(0);
      expect(verse).toBeGreaterThan(0);
    }
  });
});

describe("bookLabel", () => {
  it("uses manifest Tagalog names when lang=tl", () => {
    expect(bookLabel(19, "tl", METAS)).toBe("Mga Awit");
  });
  it("uses manifest English names when lang=en", () => {
    expect(bookLabel(19, "en", METAS)).toBe("Psalms");
  });
  it("falls back to the English canon without a manifest", () => {
    expect(bookLabel(19, "tl", null)).toBe("Psalms");
  });
  it("labels unknown books safely", () => {
    expect(bookLabel(999999, "en", METAS)).toBe("Book 999999");
  });
  it("sync canonical table works", () => {
    expect(bookName(19)).toBe("Psalms");
  });
});
