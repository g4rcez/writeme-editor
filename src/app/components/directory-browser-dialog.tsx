import { Modal, Button } from "@g4rcez/components";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FolderPlusIcon } from "@phosphor-icons/react/dist/csr/FolderPlus";
import { TreeStructureIcon } from "@phosphor-icons/react/dist/csr/TreeStructure";
import { useCallback, useEffect, useState } from "react";
import { getDirname } from "@/lib/file-utils";
import { globalState, useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import type { TreeNode } from "@/types/tree";
import { TreeView } from "./tree-view";

export const DirectoryBrowserDialog = () => {
  const [state, dispatch] = useGlobalStore();
    const map = new Map(state.notes.map((x) => [x.filePath!, x]));
  const [, uiDispatch] = useUIStore();
  const [storageDir, setStorageDir] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<TreeNode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshView = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (state.directoryBrowserDialog) {
      const settings = SettingsService.load();
      if (settings.directory) return void setStorageDir(settings.directory);
      window.electronAPI.env.getHome().then(setStorageDir);
    }
  }, [state.directoryBrowserDialog]);

  const closeDialog = useCallback(() => {
    dispatch.directoryBrowserDialog(false);
  }, [dispatch]);

  const handleFileSelect = async (node: TreeNode) => {
    if (node.extension !== ".md") return;
    try {
      const result = await window.electronAPI.fs.readFile(node.path);
      if (!result.success) {
        console.error("Failed to read file:", result.error);
        return;
      }
      const title = node.name.replace(/\.md$/, "");
      const allNotes = await repositories.notes.getAll();
      const existingNote = allNotes.find((n) => n.filePath === node.path);
      if (existingNote) {
        const fullNote = await repositories.notes.getOne(existingNote.id);
        if (fullNote) {
          dispatch.note(fullNote);
          closeDialog();
          return;
        }
      }
      const newNote = Note.new(title, result.content);
      newNote.filePath = node.path;
      newNote.fileSize = result.fileSize;
      newNote.lastSynced = new Date(result.lastModified);
      await repositories.notes.save(newNote);
      dispatch.note(newNote);
      closeDialog();
    } catch (error) {
      console.error("Error opening file:", error);
    }
  };

  const handleDelete = async (node: TreeNode): Promise<boolean> => {
    const isDir = node.type === "directory";
    try {
      if (!isDir) {
        const allNotes = await repositories.notes.getAll();
        const existingNote = allNotes.find((n) => n.filePath === node.path);

        if (existingNote) {
          await dispatch.deleteNote(existingNote.id);
          refreshView();
          return true;
        }
      } else {
        const allNotes = await repositories.notes.getAll();
        const notesInDir = allNotes.filter((n) =>
          n.filePath?.startsWith(node.path + "/"),
        );
        for (const note of notesInDir) {
          await dispatch.deleteNote(note.id);
        }
      }
      const result = await window.electronAPI.fs.deleteFile(node.path);
      if (
        result === true ||
        (typeof result === "object" && result && result.success)
      ) {
        refreshView();
        return true;
      } else {
        console.error("Failed to delete:", result?.error || "Unknown error");
        return false;
      }
    } catch (error) {
      console.error("Error deleting:", error);
      return false;
    }
  };

  const handleCreateFile = useCallback(async () => {
    if (!storageDir) return;

    let parentPath = storageDir;
    if (focusedNode) {
      parentPath =
        focusedNode.type === "directory"
          ? focusedNode.path
          : getDirname(focusedNode.path);
    }

    uiDispatch.setPrompt({
      open: true,
      title: "New File",
      message: "Enter new file name (e.g. note.md):",
      placeholder: "note.md",
      onConfirm: async (fileName) => {
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
      },
    });
  }, [storageDir, focusedNode, refreshView, uiDispatch]);

  const handleCreateFolder = useCallback(async () => {
    if (!storageDir) return;

    let parentPath = storageDir;
    if (focusedNode) {
      parentPath =
        focusedNode.type === "directory"
          ? focusedNode.path
          : getDirname(focusedNode.path);
    }

    uiDispatch.setPrompt({
      open: true,
      title: "New Folder",
      message: "Enter new folder name:",
      onConfirm: async (folderName) => {
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
      },
    });
  }, [storageDir, focusedNode, refreshView, uiDispatch]);

  const handleMove = useCallback(async () => {
    if (!focusedNode) return;

    uiDispatch.setPrompt({
      open: true,
      title: "Move/Rename",
      message: `Move/Rename "${focusedNode.name}" to:`,
      initialValue: focusedNode.path,
      onConfirm: async (newPath) => {
        if (!newPath || newPath === focusedNode.path) return;

        try {
          // If it's a markdown file, sync IndexedDB
          if (focusedNode.extension === ".md") {
            const allNotes = await repositories.notes.getAll();
            const existingNote = allNotes.find(
              (n) => n.filePath === focusedNode.path,
            );

            if (existingNote) {
              const fullNote = await repositories.notes.getOne(existingNote.id);
              if (fullNote) {
                const oldDir = getDirname(focusedNode.path);
                const newDir = getDirname(newPath);
                if (oldDir === newDir) {
                  const newTitle = newPath
                    .split(/[/\\]/)
                    .pop()
                    ?.replace(/\.md$/, "");
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
            const notesInDir = allNotes.filter((n) =>
              n.filePath?.startsWith(focusedNode.path + "/"),
            );

            // Physically move first
            const result = await window.electronAPI.fs.moveFile(
              focusedNode.path,
              newPath,
            );
            if (result.success) {
              // Update paths in DB
              for (const note of notesInDir) {
                const relativePart = note.filePath!.substring(
                  focusedNode.path.length,
                );
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
            newPath,
          );
          if (result.success) {
            refreshView();
          } else {
            console.error("Failed to move:", result.error);
          }
        } catch (error) {
          console.error("Error moving:", error);
        }
      },
    });
  }, [focusedNode, refreshView, uiDispatch]);

  // Keyboard shortcuts for modal-level actions
  useEffect(() => {
    if (!state.directoryBrowserDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a prompt (though prompts are blocking,
      // some browser environments or future non-blocking versions might need this)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          handleCreateFolder();
          break;
        case "t":
          e.preventDefault();
          handleCreateFile();
          break;
        case "m":
          if (focusedNode) {
            e.preventDefault();
            handleMove();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    state.directoryBrowserDialog,
    handleCreateFolder,
    handleMove,
    focusedNode,
  ]);

  return (
    <Modal
      open={state.directoryBrowserDialog}
      onChange={(val) => dispatch.directoryBrowserDialog(val)}
      title="Browse Files"
    >
      <div className="flex flex-col h-[60vh]">
        <div className="flex justify-between items-center px-4 pb-2 mb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-4 items-center text-sm text-gray-500">
            <div className="flex gap-2 items-center">
              <TreeStructureIcon className="w-4 h-4" />
              <span>Select a file to open</span>
            </div>
            <div className="flex gap-1 items-center pl-4 border-l border-gray-200 dark:border-gray-800">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="py-1 px-2 w-32 text-xs bg-transparent rounded border border-gray-200 transition-colors outline-none dark:border-gray-800 focus:border-blue-500"
              />
              <Button
                onClick={handleCreateFile}
                className="p-1 text-gray-600 rounded transition-colors dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="New File (T)"
                theme="muted"
              >
                <FilePlusIcon className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleCreateFolder}
                className="p-1 text-gray-600 rounded transition-colors dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="New Folder (N)"
                theme="muted"
              >
                <FolderPlusIcon className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleMove}
                disabled={!focusedNode}
                className="p-1 text-gray-600 rounded transition-colors dark:text-gray-400 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                title="Move/Rename (M)"
                theme="muted"
              >
                <PencilSimpleIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="py-1 px-2 text-xs text-gray-400 rounded border border-gray-200 dark:border-gray-700">
            ↑↓ navigate • Enter select • T file • N folder • M move • Del delete
          </div>
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-thin">
          {storageDir ? (
            <>
              <div className="py-2 px-4 text-xs text-gray-500 bg-gray-50 border-b border-gray-100 dark:border-gray-800 dark:bg-gray-800/50">
                {storageDir}
              </div>
              <TreeView
                map={map}
                rootPath={storageDir}
                onDelete={handleDelete}
                searchQuery={searchQuery}
                onFocusChange={setFocusedNode}
                onFileSelect={handleFileSelect}
                key={`${storageDir}-${refreshKey}`}
              />
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No storage directory configured.</p>
              <p className="mt-2 text-sm">
                Please set up your workspace first.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
