import { useState, useEffect } from "react";
import { TreeView } from "../tree-view";
import { SettingsService } from "../../../store/settings";
import { Button } from "@g4rcez/components";
import { FolderOpen, Plus, FolderPlus } from "lucide-react";
import { repositories, globalDispatch } from "../../../store/global.store";
import { Note } from "../../../store/note";
import { useNavigate } from "react-router-dom";
import { TreeNode } from "../../../types/tree";
import { isElectron } from "../../../lib/is-electron";
import { NoteListSidebar } from "../note-list/note-list-sidebar";

export const ExplorerPane = () => {
  const [rootPath, setRootPath] = useState<string | null>(
    SettingsService.load().explorerRoot,
  );
  const navigate = useNavigate();

  const handleChooseDirectory = async () => {
    const path = await window.electronAPI.fs.chooseDirectory();
    if (path) {
      await SettingsService.save({ explorerRoot: path });
      setRootPath(path);
    }
  };

  const handleFileSelect = async (node: TreeNode) => {
    if (node.type === "file" && node.extension === ".md") {
      // 1. Check if note exists in DB
      const allNotes = await repositories.notes.getAll();
      let note = allNotes.find((n) => n.filePath === node.path);

      if (!note) {
        // 2. Create new note from file
        const content = await window.electronAPI.fs.readFile(node.path);

        note = Note.new(node.name.replace(".md", ""), content || "");
        note.filePath = node.path;
        await repositories.notes.save(note);
        // Refresh global notes
        const updatedNotes = await repositories.notes.getAll();
        globalDispatch.notes(updatedNotes);
      }

      navigate(`/note/${note.id}`);
    }
  };

  // Browser Mode: Just render the note list
  if (!isElectron()) {
    return <NoteListSidebar />;
  }

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <FolderOpen size={32} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1">No folder opened</h3>
          <p className="text-xs text-muted-foreground">
            Open a folder to start managing your local markdown notes.
          </p>
        </div>
        <Button onClick={handleChooseDirectory} size="small" className="w-full">
          Open Folder
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex gap-1">
          <button
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="New Note"
          >
            <Plus size={14} />
          </button>
          <button
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-hide">
        <TreeView rootPath={rootPath} onFileSelect={handleFileSelect} />
      </div>
    </div>
  );
};
