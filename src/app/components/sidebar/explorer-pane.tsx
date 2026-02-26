import { isElectron } from "@/lib/is-electron";
import { globalDispatch, repositories } from "@/store/global.store";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { type TreeNode } from "@/types/tree";
import { Button } from "@g4rcez/components";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { FolderPlusIcon } from "@phosphor-icons/react/dist/csr/FolderPlus";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NoteListSidebar } from "../note-list/note-list-sidebar";
import { TreeView } from "../tree-view";

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

  const onFileSelect = async (node: TreeNode) => {
    if (node.type === "file" && node.extension === ".md") {
      const allNotes = await repositories.notes.getAll();
      let note = allNotes.find((n) => n.filePath === node.path);
      if (!note) {
        const content = await window.electronAPI.fs.readFile(node.path);
        note = Note.new(node.name.replace(".md", ""), content || "");
        note.filePath = node.path;
        await repositories.notes.save(note);
        const updatedNotes = await repositories.notes.getAll();
        globalDispatch.notes(updatedNotes);
      }
      navigate(`/note/${note.id}`);
    }
  };

  if (!isElectron()) {
    return <NoteListSidebar />;
  }

  if (!rootPath) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center p-6 h-full text-center">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <FolderOpenIcon size={32} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">No folder opened</h3>
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
      <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex gap-1">
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="New Note"
          >
            <PlusIcon size={14} />
          </button>
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="New Folder"
          >
            <FolderPlusIcon size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-hide">
        <TreeView rootPath={rootPath} onFileSelect={onFileSelect} />
      </div>
    </div>
  );
};
