import { useEffect, useCallback, useState } from "react";
import { FolderTree, X } from "lucide-react";
import { useGlobalStore, repositories } from "../../store/global.store";
import { SettingsRepository } from "../../store/settings";
import { TreeView } from "./tree-view";
import { Note } from "../../store/note";
import { db } from "../../store/repositories/dexie/dexie-db";
import type { TreeNode } from "../../types/tree";

export const DirectoryBrowserDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [storageDir, setStorageDir] = useState<string | null>(null);

  // Load storage directory when dialog opens
  useEffect(() => {
    if (state.directoryBrowserDialog) {
      const settings = SettingsRepository.load();
      setStorageDir(settings.storageDirectory);
    }
  }, [state.directoryBrowserDialog]);

  const closeDialog = useCallback(() => {
    dispatch.directoryBrowserDialog(false);
  }, [dispatch]);

  // Handle keyboard events
  useEffect(() => {
    if (!state.directoryBrowserDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.directoryBrowserDialog, closeDialog]);

  const handleFileSelect = useCallback(
    async (node: TreeNode) => {
      if (node.extension !== ".md") return;

      try {
        // Read file content
        const result = await window.electronAPI.fs.readFile(node.path);

        if (!result.success) {
          console.error("Failed to read file:", result.error);
          return;
        }

        // Extract title from filename (remove .md extension)
        const title = node.name.replace(/\.md$/, "");

        // Check if this note already exists in the database by filePath
        const allNotes = await repositories.notes.getAll();
        const existingNote = allNotes.find((n) => n.filePath === node.path);

        if (existingNote) {
          // Load full note with content
          const fullNote = await repositories.notes.getOne(existingNote.id);
          if (fullNote) {
            dispatch.note(fullNote);
            closeDialog();
            return;
          }
        }

        // Create a new note from the file (file already exists, just register in IndexedDB)
        const newNote = Note.new(title, result.content);
        newNote.filePath = node.path;
        newNote.fileSize = result.fileSize;
        newNote.lastSynced = new Date(result.lastModified);

        // Add metadata directly to IndexedDB without re-writing the file
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { content: _content, ...metadata } = newNote as Record<string, unknown>;
        await db.notes.add(metadata as Note, newNote.id);

        dispatch.note(newNote);
        closeDialog();
      } catch (error) {
        console.error("Error opening file:", error);
      }
    },
    [dispatch, closeDialog]
  );

  if (!state.directoryBrowserDialog) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onClick={closeDialog}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-yellow-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Browse Files
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded">
              ↑↓ navigate • Enter select • Esc close
            </div>
            <button
              onClick={closeDialog}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          {storageDir ? (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {storageDir}
              </div>
              <TreeView rootPath={storageDir} onFileSelect={handleFileSelect} />
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No storage directory configured.</p>
              <p className="text-sm mt-2">
                Please set up your workspace first.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
