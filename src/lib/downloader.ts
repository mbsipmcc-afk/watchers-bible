import { importCorpus, expectedVersesFor, type TranslationId } from "./bible";

/**
 * The single corpus downloader — used by the Translations manager and the
 * first-run starter pack. Streams the static /bible/<id>.sqlite file with
 * real progress, then hands the bytes to the worker to persist + verify.
 */

export async function fetchCorpusBytes(
  id: TranslationId,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(`/bible/${id}.sqlite`);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const header = Number(res.headers.get("content-length"));
  // content-length may be absent or describe the gzip wire size; treat it as
  // a hint only — the buffer grows if decompressed bytes exceed it.
  const total =
    Number.isFinite(header) && header > 4096 ? header : null;

  let buf: Uint8Array;
  if (total) {
    buf = new Uint8Array(total);
  } else {
    buf = new Uint8Array(1024 * 1024); // grow-by-doubling scratch
  }
  let loaded = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.length === 0) continue;
    if (loaded + value.length > buf.length) {
      const next = new Uint8Array(Math.max(buf.length * 2, loaded + value.length));
      next.set(buf.subarray(0, loaded));
      buf = next;
    }
    buf.set(value, loaded);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  return buf.slice(0, loaded).buffer as ArrayBuffer;
}

export async function downloadAndInstall(
  id: TranslationId,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<{ persisted: boolean | undefined }> {
  const bytes = await fetchCorpusBytes(id, onProgress);
  const expected = await expectedVersesFor(id);
  const info = await importCorpus({ id, bytes, expectedVerses: expected });
  return { persisted: info.persisted };
}
