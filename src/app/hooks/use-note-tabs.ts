import type { Note } from "@/store/note";
import { useMemo } from "react";

export const useNoteTabs = (notes: Note[]) => {
  const notesById = useMemo(() => {
    const map = new Map<string, Note>();
    for (const note of notes) {
      map.set(note.id, note);
    }
    return map;
  }, [notes]);
  return notesById;
};
