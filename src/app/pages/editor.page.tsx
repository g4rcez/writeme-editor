import { useEffect, useState } from "react";
import { repositories, useGlobalStore } from "../../store/global.store";
import { Note } from "../../store/note";
import { Editor } from "../editor";

export default function EditorPage() {
  const [state] = useGlobalStore();
  const [loadedNote, setLoadedNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!state.note) {
      setLoadedNote(null);
      setIsLoading(false);
      return;
    }
    if (state.note.content) {
      setLoadedNote(state.note);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    repositories.notes.getOne(state.note.id).then((fullNote) => {
      if (fullNote) setLoadedNote(fullNote);
      else setLoadedNote(state.note);
      setIsLoading(false);
    });
  }, [state.note?.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">Loading...</div>
    );
  }

  if (!loadedNote) {
    return (
      <div className="flex justify-center items-center p-8">
        No note selected
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <Editor
        note={loadedNote}
        key={loadedNote.id}
        content={loadedNote.content}
      />
    </div>
  );
}
