import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useGlobalStore, repositories } from "../../store/global.store";
import { Note } from "../../store/note";
import { getUniqueNoteTitle } from "../../lib/file-utils";

export const NewNoteButton = () => {
  const [state, dispatch] = useGlobalStore();

  const createNewNote = async () => {
    const currentProject = Note.DEFAULT_PROJECT;
    const isDefaultProject = true;
    const notesForUniqueness = isDefaultProject
      ? state.notes
      : state.notes.filter((n) => n.project === currentProject);
    const title = getUniqueNoteTitle("Untitled", notesForUniqueness);
    const note = Note.new(title, "", currentProject);
    await repositories.notes.save(note);
    dispatch.note(note);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNewNote();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <button
      onClick={createNewNote}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md text-foreground/70 transition-all hover:text-foreground hover:bg-muted/30"
      title="New note (⌘N)"
    >
      <Plus className="w-4 h-4" />
      <span className="hidden sm:inline">New</span>
    </button>
  );
};
