import { useCallback, useEffect } from "react";
import { globalDispatch, repositories, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { useNavigate } from "react-router-dom";
import { getUniqueNoteTitle } from "@/lib/file-utils";

export const useJsonDrop = () => {
  const [state] = useGlobalStore();
  const navigate = useNavigate();

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer?.files || []);
    const jsonFiles = files.filter(f => f.name.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const text = await file.text();
        JSON.parse(text); // Validate

        const title = getUniqueNoteTitle(file.name.replace(".json", ""), state.notes);
        const note = Note.new(title, text, "json" as any);
        
        await repositories.notes.save(note);
        globalDispatch.notes(await repositories.notes.getAll());
        
        // Open the first dropped JSON file
        if (file === jsonFiles[0]) {
          globalDispatch.note(note);
          navigate(`/note/${note.id}`);
        }
      } catch (err) {
        console.error("Failed to parse dropped JSON:", err);
      }
    }
  }, [state.notes, navigate]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);
    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [handleDrop, handleDragOver]);
};
