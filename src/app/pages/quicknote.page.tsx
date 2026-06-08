import { startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { Editor } from "@/app/editor";
import { isElectron } from "@/lib/is-electron";
import {
  getDailyQuickNotePath,
  getDailyQuickNoteTitle,
} from "@/lib/quicknote-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { SettingsService } from "@/store/settings";

async function getOrCreateDailyQuickNote(date: Date): Promise<Note> {
  const day = startOfDay(date);
  const settings = SettingsService.load();

  if (isElectron() && settings.directory) {
    const filePath = getDailyQuickNotePath(settings.directory, day);
    const existingMetadata =
      await window.electronAPI.db.notes.getByFilePath(filePath);

    if (existingMetadata) {
      const existing = await repositories.notes.getOne(existingMetadata.id);
      if (existing) return existing;

      const recreateResult = await window.electronAPI.fs.writeFile(
        filePath,
        "",
      );
      if (!recreateResult.success) {
        throw new Error(
          `Failed to recreate quick note: ${recreateResult.error}`,
        );
      }
      return Note.parse({ ...existingMetadata, content: "" });
    }

    const statResult = await window.electronAPI.fs.statFile(filePath);
    if (!statResult.success) {
      throw new Error(`Failed to check quick note: ${statResult.error}`);
    }

    const readResult = statResult.exists
      ? await window.electronAPI.fs.readFile(filePath)
      : null;
    if (readResult && !readResult.success) {
      throw new Error(`Failed to read quick note: ${readResult.error}`);
    }

    const content = readResult?.content ?? "";
    const fileResult = statResult.exists
      ? statResult
      : await window.electronAPI.fs.writeFile(filePath, content);

    if (!fileResult.success) {
      throw new Error(`Failed to create quick note: ${fileResult.error}`);
    }

    const note = Note.new(getDailyQuickNoteTitle(day), content, NoteType.quick);
    note.setFilePath(filePath, new Date(fileResult.lastModified));
    note.fileSize = fileResult.fileSize ?? content.length;
    await repositories.notes.save(note);
    return note;
  }

  const existing = await repositories.notes.getQuicknoteByDate(day);
  if (existing) return existing;

  const note = Note.new(getDailyQuickNoteTitle(day), "", NoteType.quick);
  await repositories.notes.save(note);
  return note;
}

export default function QuickNotePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, dispatch] = useGlobalStore();

  useEffect(() => {
    let ignored = false;
    async function request() {
      setLoading(true);
      setError(null);
      try {
        const note = await getOrCreateDailyQuickNote(new Date());
        if (ignored) return;
        dispatch.note(note, false);
      } catch (error) {
        console.error("Failed to open quick note:", error);
        if (!ignored) setError("Failed to open quick note");
      } finally {
        if (!ignored) setLoading(false);
      }
    }
    request();
    return () => {
      ignored = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading || (!error && !state.note)) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        Loading Quick Note...
      </div>
    );
  }

  if (error || !state.note) {
    return (
      <div className="flex justify-center items-center h-full text-muted-foreground">
        {error ?? "Quick note not found"}
      </div>
    );
  }
  return (
    <div className="mx-auto w-full h-full print:block print:h-auto print:overflow-visible max-w-safe">
      <div className="quicknote-window-drag-region flex justify-between items-center py-2 pl-20 mb-4 border-b border-card-border">
        <h1 className="text-lg font-semibold truncate">{state.note.title}</h1>
        <span className="text-xs text-disabled">Press Esc to close</span>
      </div>
      <Editor content={state.note.content} note={state.note} />
    </div>
  );
}
