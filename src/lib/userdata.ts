import Dexie, { type Table } from "dexie";

/**
 * The user's own study data — notes, highlights, bookmarks, and app state —
 * all on-device (IndexedDB), same as the Bible corpora. Nothing leaves the
 * device: the whole app is account-free by design.
 */

export type NoteRow = {
  id?: number;
  book: number;
  chapter: number;
  verse: number;
  translation: string;
  body: string;
  updatedAt: number;
};

export type HighlightRow = {
  book: number;
  chapter: number;
  verse: number;
  translation: string;
  color: number; // 1..5
  updatedAt: number;
};

export type BookmarkRow = {
  book: number;
  chapter: number;
  verse: number;
  translation: string;
  createdAt: number;
};

export type StateRow = { key: string; value: unknown };

export type LastRead = {
  translation: string;
  book: number;
  chapter: number;
  verse?: number;
  at: number;
};

class WatchersDb extends Dexie {
  notes!: Table<NoteRow, number>;
  highlights!: Table<HighlightRow, number>;
  bookmarks!: Table<BookmarkRow, number>;
  state!: Table<StateRow, string>;

  constructor() {
    super("watchers-bible");
    this.version(1).stores({
      notes: "++id, updatedAt, [book+chapter+verse]",
      highlights: "[book+chapter+verse+translation], updatedAt",
      bookmarks: "[book+chapter+verse+translation], createdAt",
      state: "key",
    });
  }
}

export const db = new WatchersDb();

/* ── highlights ─────────────────────────────────────────────────────────── */

export async function setHighlight(
  translation: string,
  book: number,
  chapter: number,
  verse: number,
  color: number,
): Promise<void> {
  await db.highlights.put({ book, chapter, verse, translation, color, updatedAt: Date.now() });
}

export async function removeHighlight(
  translation: string,
  book: number,
  chapter: number,
  verse: number,
): Promise<void> {
  await db.highlights
    .where("[book+chapter+verse+translation]")
    .equals([book, chapter, verse, translation])
    .delete();
}

/* ── bookmarks ──────────────────────────────────────────────────────────── */

export async function addBookmark(
  translation: string,
  book: number,
  chapter: number,
  verse: number,
): Promise<void> {
  await db.bookmarks.put({
    book,
    chapter,
    verse,
    translation,
    createdAt: Date.now(),
  });
}

export async function removeBookmark(
  translation: string,
  book: number,
  chapter: number,
  verse: number,
): Promise<void> {
  await db.bookmarks
    .where("[book+chapter+verse+translation]")
    .equals([book, chapter, verse, translation])
    .delete();
}

/* ── notes ──────────────────────────────────────────────────────────────── */

export async function saveNote(
  translation: string,
  book: number,
  chapter: number,
  verse: number,
  body: string,
  id?: number,
): Promise<void> {
  const trimmed = body.trim();
  if (!id && !trimmed) return;
  await db.notes.put({
    id,
    book,
    chapter,
    verse,
    translation,
    body: trimmed,
    updatedAt: Date.now(),
  });
}

export async function deleteNote(id: number): Promise<void> {
  await db.notes.delete(id);
}

/* ── app state (last read position) ─────────────────────────────────────── */

export async function getState<T>(key: string): Promise<T | undefined> {
  const row = await db.state.get(key);
  return row?.value as T | undefined;
}

export async function setState(key: string, value: unknown): Promise<void> {
  await db.state.put({ key, value });
}

export async function saveLastRead(lastRead: LastRead): Promise<void> {
  lastRead.at = Date.now();
  await setState("lastRead", lastRead);
  // Synchronous mirror so the tab bar can resume instantly without waiting
  // on IndexedDB.
  try {
    localStorage.setItem("wb-lastread", JSON.stringify(lastRead));
  } catch {
    /* storage unavailable: Dexie copy is the source of truth */
  }
}

export function readLastReadSync(): LastRead | null {
  try {
    const raw = localStorage.getItem("wb-lastread");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastRead;
    if (typeof parsed?.translation !== "string" || typeof parsed?.book !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
