import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { globalDispatch, useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";

export default function NotePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [state] = useGlobalStore();
  const navigate = useNavigate();
  const isLoading = state.note === null;
  const loadedNote = state.note;

  useEffect(() => {
    globalDispatch.selectNoteById(noteId);
  }, [noteId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">Loading...</div>
    );
  }

  if (!loadedNote) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center p-8">
        <h2 className="text-xl">Note not found</h2>
        <p className="text-muted-foreground">
          The note you are looking for does not exist or has been deleted.
        </p>
        <button
          onClick={() => navigate("/")}
          className="py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <Editor
        note={loadedNote}
        key={loadedNote.id}
        content={loadedNote.content || ""}
      />
    </div>
  );
}
