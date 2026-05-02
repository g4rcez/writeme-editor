import { useEffect, useState } from "react";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { Editor } from "@/app/editor";

const MATH_INITIAL_CONTENT = "```math\n```";
const MATH_NOTE_TITLE = "Math Scratchpad";

export default function MathNotePage() {
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useGlobalStore();

  useEffect(() => {
    let ignored = false;
    async function load() {
      setLoading(true);
      const { mathNoteId } = SettingsService.load();
      let note: Note | null = mathNoteId
        ? await repositories.notes.getOne(mathNoteId)
        : null;
      if (!note) {
        note = Note.new(MATH_NOTE_TITLE, MATH_INITIAL_CONTENT, NoteType.note);
        await repositories.notes.save(note);
        await SettingsService.save({ mathNoteId: note.id });
      }
      if (ignored) return;
      dispatch.note(note, false);
      setLoading(false);
    }
    load();
    return () => {
      ignored = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (loading || !state.note) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full h-full print:block print:h-auto print:overflow-visible max-w-safe">
      <div className="flex justify-between items-center py-2 mb-4 border-b border-card-border">
        <h1 className="text-lg font-semibold">{state.note.title}</h1>
        <span className="text-xs text-disabled">Press Esc to close</span>
      </div>
      <Editor content={state.note.content} note={state.note} />
    </div>
  );
}
