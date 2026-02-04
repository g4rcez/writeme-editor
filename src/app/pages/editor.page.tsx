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

    // If note has content, use it directly
    if (state.note.content) {
      setLoadedNote(state.note);
      setIsLoading(false);
      return;
    }

    // Always load from repository to ensure we have the latest content
    // This handles both filesystem mode (content in files) and IndexedDB mode
    setIsLoading(true);
    repositories.notes.getOne(state.note.id).then((fullNote) => {
      if (fullNote) {
        setLoadedNote(fullNote);
      } else {
        // Fallback to state note if repository returns null (e.g., new unsaved note)
        setLoadedNote(state.note);
      }
      setIsLoading(false);
    });
  }, [state.note?.id]);

  if (isLoading) {
    return <div className="flex justify-center items-center p-8">Loading...</div>;
  }

  if (!loadedNote) {
    return <div className="flex justify-center items-center p-8">No note selected</div>;
  }

  return (
    <div className="flex flex-col gap-8 w-full h-full">
      <Editor note={loadedNote} key={loadedNote.id} content={loadedNote.content} />
    </div>
  );
}
