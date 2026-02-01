import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useGlobalStore, repositories } from "../../store/global.store";
import { Note } from "../../store/note";
import { SettingsRepository } from "../../store/settings";

export const NewNoteButton = () => {
  const [, dispatch] = useGlobalStore();

  const createNewNote = async () => {
    const settings = SettingsRepository.load();
    const note = Note.new("Untitled", "", settings.storageDirectory || undefined);
    await repositories.notes.save(note);
    dispatch.note(note);
    dispatch.notes(await repositories.notes.getAll());
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
