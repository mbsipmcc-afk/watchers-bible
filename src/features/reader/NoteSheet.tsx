import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "../../components/ui";
import { saveNote, deleteNote, type NoteRow } from "../../lib/userdata";

export function NoteSheet({
  open,
  onClose,
  note,
  refLabel,
  translation,
  book,
  chapter,
  verse,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  note: NoteRow | undefined;
  refLabel: string;
  translation: string;
  book: number;
  chapter: number;
  verse: number;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) setBody(note?.body ?? "");
  }, [open, note]);

  const existingId = note?.id;

  const onSave = async () => {
    await saveNote(translation, book, chapter, verse, body, existingId);
    onSaved();
    onClose();
  };

  const onDelete = async () => {
    if (existingId) await deleteNote(existingId);
    onSaved();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Note on ${refLabel}`}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="What did this verse show you?"
        className="w-full resize-none rounded-xl bg-surface2 p-3 text-[15px] leading-relaxed outline-none placeholder:text-muted"
      />
      <div className="mt-3 flex gap-2">
        {existingId ? (
          <button
            onClick={onDelete}
            aria-label="Delete note"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface2 text-fg"
          >
            <Trash2 size={18} />
          </button>
        ) : null}
        <button
          onClick={onSave}
          className="h-11 flex-1 rounded-xl bg-accent text-[15px] font-semibold text-accent-fg active:opacity-80"
        >
          {existingId ? "Update note" : "Save note"}
        </button>
      </div>
    </Sheet>
  );
}
