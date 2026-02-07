import { useEffect, useCallback, useState } from "react";
import { FolderTree, FolderPlus, Edit2, FilePlus } from "lucide-react";
import { useGlobalStore, repositories } from "../../store/global.store";
import { isElectron } from "../../lib/is-electron";
import { SettingsRepository } from "../../store/settings";
import { TreeView } from "./tree-view";
import { Note } from "../../store/note";
import { db } from "../../store/repositories/dexie/dexie-db";
import type { TreeNode } from "../../types/tree";
import { Modal } from "@g4rcez/components";
import { getDirname } from "../../lib/file-utils";

export const DirectoryBrowserDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [storageDir, setStorageDir] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<TreeNode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // This component requires filesystem access (Electron only)
  if (!isElectron()) return null;

  const refreshView = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

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
        const { content: _content, ...metadata } = newNote as unknown as Record<string, unknown>;
        await db.notes.add(metadata as unknown as Note, newNote.id);

        dispatch.note(newNote);
        closeDialog();
      } catch (error) {
        console.error("Error opening file:", error);
      }
    },
    [dispatch, closeDialog]
  );

  const handleDelete = useCallback(async (node: TreeNode): Promise<boolean> => {
    const isDir = node.type === "directory";
    const msg = isDir 
      ? `To delete this directory and ALL its contents, type its name: "${node.name}"`
      : `To delete this file, type its name: "${node.name}"`;

    const confirmation = window.prompt(msg);
    if (confirmation !== node.name) {
      return false;
    }

    try {
      if (!isDir) {
        // Sync with IndexedDB if this is a registered note
        const allNotes = await repositories.notes.getAll();
        const existingNote = allNotes.find((n) => n.filePath === node.path);

        if (existingNote) {
          const deleted = await repositories.notes.delete(existingNote.id);
          if (deleted) refreshView();
          return deleted;
        }
      } else {
        // If it's a directory, we might want to cleanup multiple notes from DB
        const allNotes = await repositories.notes.getAll();
        const notesInDir = allNotes.filter((n) => n.filePath?.startsWith(node.path + "/"));
        for (const note of notesInDir) {
           await repositories.notes.delete(note.id);
        }
      }

      // Delete from filesystem (handles both files and recursive dirs now)
      const result = await window.electronAPI.fs.deleteFile(node.path);
      if (
        result === true ||
        (typeof result === "object" && result && result.success)
      ) {
        refreshView();
        return true;
      } else {
        console.error(
          "Failed to delete:",
          result?.error || "Unknown error"
        );
        return false;
      }
    } catch (error) {
      console.error("Error deleting:", error);
      return false;
    }
  }, [refreshView]);

  const handleCreateFile = useCallback(async () => {
    if (!storageDir) return;

    let parentPath = storageDir;
    if (focusedNode) {
      parentPath =
        focusedNode.type === "directory"
          ? focusedNode.path
          : getDirname(focusedNode.path);
    }

    const fileName = window.prompt("Enter new file name (e.g. note.md):");
    if (!fileName) return;

    try {
      const newPath = `${parentPath}/${fileName.endsWith(".md") ? fileName : fileName + ".md"}`;
      const result = await window.electronAPI.fs.writeFile(newPath, "");
      if (result.success) {
        refreshView();
      } else {
        console.error("Failed to create file:", result.error);
      }
    } catch (error) {
      console.error("Error creating file:", error);
    }
  }, [storageDir, focusedNode, refreshView]);

  const handleCreateFolder = useCallback(async () => {
    if (!storageDir) return;

    let parentPath = storageDir;
    if (focusedNode) {
      parentPath =
        focusedNode.type === "directory"
          ? focusedNode.path
          : getDirname(focusedNode.path);
    }

    const folderName = window.prompt("Enter new folder name:");
    if (!folderName) return;

    try {
      const newPath = `${parentPath}/${folderName}`;
      const result = await window.electronAPI.fs.mkdir(newPath);
      if (result.success) {
        refreshView();
      } else {
        console.error("Failed to create folder:", result.error);
      }
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  }, [storageDir, focusedNode, refreshView]);

  const handleMove = useCallback(async () => {
    if (!focusedNode) return;

    const newPath = window.prompt(
      `Move/Rename "${focusedNode.name}" to:`,
      focusedNode.path
    );
    if (!newPath || newPath === focusedNode.path) return;

    try {
      // If it's a markdown file, sync IndexedDB
      if (focusedNode.extension === ".md") {
        const allNotes = await repositories.notes.getAll();
        const existingNote = allNotes.find(
          (n) => n.filePath === focusedNode.path
        );

        if (existingNote) {
          const fullNote = await repositories.notes.getOne(existingNote.id);
          if (fullNote) {
            const oldDir = getDirname(focusedNode.path);
            const newDir = getDirname(newPath);
            if (oldDir === newDir) {
              const newTitle = newPath.split(/[/\\]/).pop()?.replace(/\.md$/, "");
              if (newTitle) fullNote.title = newTitle;
            }
            fullNote.filePath = newPath;
            await repositories.notes.update(fullNote.id, fullNote);
            refreshView();
            return;
          }
        }
      } else if (focusedNode.type === "directory") {
        // If it's a directory, update all notes contained within it
        const allNotes = await repositories.notes.getAll();
        const notesInDir = allNotes.filter((n) => n.filePath?.startsWith(focusedNode.path + "/"));
        
        // Physically move first
        const result = await window.electronAPI.fs.moveFile(focusedNode.path, newPath);
        if (result.success) {
          // Update paths in DB
          for (const note of notesInDir) {
            const relativePart = note.filePath!.substring(focusedNode.path.length);
            const updatedNote = await repositories.notes.getOne(note.id);
            if (updatedNote) {
              updatedNote.filePath = newPath + relativePart;
              await repositories.notes.update(updatedNote.id, updatedNote);
            }
          }
          refreshView();
        } else {
          console.error("Failed to move directory:", result.error);
        }
        return;
      }

      // Fallback for non-note files or if not in DB
      const result = await window.electronAPI.fs.moveFile(
        focusedNode.path,
        newPath
      );
      if (result.success) {
        refreshView();
      } else {
        console.error("Failed to move:", result.error);
      }
    } catch (error) {
      console.error("Error moving:", error);
    }
  }, [focusedNode, refreshView]);

  // Keyboard shortcuts for modal-level actions
  useEffect(() => {
    if (!state.directoryBrowserDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a prompt (though prompts are blocking, 
      // some browser environments or future non-blocking versions might need this)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          handleCreateFolder();
          break;
        case 't':
          e.preventDefault();
          handleCreateFile();
          break;
        case 'm':
          if (focusedNode) {
            e.preventDefault();
            handleMove();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.directoryBrowserDialog, handleCreateFolder, handleMove, focusedNode]);

  return (
    <Modal
      open={state.directoryBrowserDialog}
      onChange={(val) => dispatch.directoryBrowserDialog(val)}
      title="Browse Files"
    >
      <div className="flex flex-col h-[60vh]">
        <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-200 dark:border-gray-800 mb-2">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              <span>Select a file to open</span>
            </div>
            <div className="flex items-center gap-1 border-l pl-4 border-gray-200 dark:border-gray-800">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-800 rounded bg-transparent outline-none focus:border-blue-500 transition-colors w-32"
              />
              <button
                onClick={handleCreateFile}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-gray-600 dark:text-gray-400"
                title="New File (T)"
              >
                <FilePlus className="w-4 h-4" />
              </button>
              <button
                onClick={handleCreateFolder}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-gray-600 dark:text-gray-400"
                title="New Folder (N)"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <button
                onClick={handleMove}
                disabled={!focusedNode}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-gray-600 dark:text-gray-400 disabled:opacity-30"
                title="Move/Rename (M)"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded">
            ↑↓ navigate • Enter select • T file • N folder • M move • Del delete
          </div>
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-thin">
          {storageDir ? (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {storageDir}
              </div>
              <TreeView
                key={`${storageDir}-${refreshKey}`}
                rootPath={storageDir}
                onFileSelect={handleFileSelect}
                onDelete={handleDelete}
                onFocusChange={setFocusedNode}
                searchQuery={searchQuery}
              />
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
    </Modal>
  );
};
