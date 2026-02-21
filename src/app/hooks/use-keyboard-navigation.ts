import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NoteWithTags } from "./use-note-list";

export function useKeyboardNavigation(
  notes: NoteWithTags[],
  selectedNoteId: string | undefined,
  containerRef: React.RefObject<HTMLElement>,
) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we have notes and focus is within the container
      if (
        notes.length === 0 ||
        !containerRef.current?.contains(e.target as Node)
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();

        const currentIndex = notes.findIndex((n) => n.id === selectedNoteId);
        let nextIndex = 0;

        if (currentIndex === -1) {
          nextIndex = 0;
        } else {
          if (e.key === "ArrowDown") {
            nextIndex = Math.min(currentIndex + 1, notes.length - 1);
          } else {
            nextIndex = Math.max(currentIndex - 1, 0);
          }
        }

        const nextNote = notes[nextIndex];
        if (nextNote) {
          navigate(`/note/${nextNote.id}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notes, selectedNoteId, navigate, containerRef]);
}
