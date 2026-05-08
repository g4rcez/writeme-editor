import { isElectron } from "@/lib/is-electron";
import {
  globalDispatch,
  repositories,
  useGlobalStore,
} from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { useUIStore, type MediaSource } from "@/store/ui.store";
import { type TreeNode } from "@/types/tree";
import { Button } from "@g4rcez/components";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { FolderPlusIcon } from "@phosphor-icons/react/dist/csr/FolderPlus";
import { GlobeSimpleIcon } from "@phosphor-icons/react/dist/csr/GlobeSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NoteListSidebar } from "../note-list/note-list-sidebar";
import { TreeView } from "../tree-view";
import { DbNotesTree } from "./db-notes-tree";

const MEDIA_EXTENSION_MAP = {
  ".bmp": { mediaType: "image", mimeType: "image/bmp" },
  ".gif": { mediaType: "image", mimeType: "image/gif" },
  ".mp4": { mediaType: "video", mimeType: "video/mp4" },
  ".ogg": { mediaType: "video", mimeType: "video/ogg" },
  ".png": { mediaType: "image", mimeType: "image/png" },
  ".jpg": { mediaType: "image", mimeType: "image/jpeg" },
  ".jpeg": { mediaType: "image", mimeType: "image/jpeg" },
  ".webm": { mediaType: "video", mimeType: "video/webm" },
  ".webp": { mediaType: "image", mimeType: "image/webp" },
  ".pdf": { mediaType: "pdf", mimeType: "application/pdf" },
  ".svg": { mediaType: "image", mimeType: "image/svg+xml" },
  ".mov": { mediaType: "video", mimeType: "video/quicktime" },
} satisfies Record<
  string,
  { mediaType: MediaSource["type"]; mimeType: string }
>;

type EXTENSION_TYPE = keyof typeof MEDIA_EXTENSION_MAP;

export const ExplorerPane = () => {
  const [state] = useGlobalStore();
  const [, uiDispatch] = useUIStore();
  const map = new Map(state.notes.map((x) => [x.filePath!, x]));
  const navigate = useNavigate();
  const [showDbNotes, setShowDbNotes] = useState(false);

  const handleDelete = useCallback(async (node: TreeNode): Promise<boolean> => {
    const isDir = node.type === "directory";
    try {
      if (!isDir) {
        const allNotes = await repositories.notes.getAll();
        const existingNote = allNotes.find((n) => n.filePath === node.path);
        if (existingNote) {
          await globalDispatch.deleteNote(existingNote.id);
          return true;
        }
      } else {
        const allNotes = await repositories.notes.getAll();
        const notesInDir = allNotes.filter((n) =>
          n.filePath?.startsWith(node.path + "/"),
        );
        for (const note of notesInDir) {
          await globalDispatch.deleteNote(note.id);
        }
      }
      const result = await window.electronAPI.fs.deleteFile(node.path);
      return typeof result === "object" && result !== null
        ? result.success
        : result === true;
    } catch (error) {
      console.error("Error deleting:", error);
      return false;
    }
  }, []);

  const handleChooseDirectory = async () => {
    const path = await window.electronAPI.fs.chooseDirectory();
    if (path) {
      await globalDispatch.switchWorkspace(path);
    }
  };

  const onFileSelect = async (node: TreeNode) => {
    if (node.type === "file" && node.extension === ".md") {
      const allNotes = await repositories.notes.getAll();
      let note = allNotes.find((n) => n.filePath === node.path);
      if (!note) {
        const result = await window.electronAPI.fs.readFile(node.path);
        note = Note.new(node.name.replace(".md", ""), result.content || "");
        note.filePath = node.path;
        await repositories.notes.save(note);
        const updatedNotes = await repositories.notes.getAll();
        globalDispatch.notes(updatedNotes);
      }
      navigate(`/note/${note.id}`);
    } else if (node.type === "file" && node.extension === ".json") {
      const allNotes = await repositories.notes.getAll();
      let note = allNotes.find((n) => n.filePath === node.path);
      if (!note) {
        const result = await window.electronAPI.fs.readFile(node.path);
        note = Note.new(
          node.name.replace(".json", ""),
          result.content || "",
          NoteType.json,
        );
        note.filePath = node.path;
        await repositories.notes.save(note);
        const updatedNotes = await repositories.notes.getAll();
        globalDispatch.notes(updatedNotes);
      }
      navigate(`/note/${note.id}`);
    } else if (
      node.type === "file" &&
      node.extension &&
      MEDIA_EXTENSION_MAP[node.extension as EXTENSION_TYPE]
    ) {
      const parentDir = node.path.substring(0, node.path.lastIndexOf("/"));
      const dirResult = await window.electronAPI.fs.readDir(parentDir);
      const siblingMediaFiles = (dirResult?.entries ?? []).filter(
        (entry) =>
          entry.type === "file" &&
          entry.extension &&
          MEDIA_EXTENSION_MAP[entry.extension as EXTENSION_TYPE],
      );
      const sources = (
        await Promise.all(
          siblingMediaFiles.map(async (sibling) => {
            const { mediaType, mimeType } =
              MEDIA_EXTENSION_MAP[sibling.extension! as EXTENSION_TYPE];
            const result = await window.electronAPI.fs.readBinaryFile(
              sibling.path,
            );
            if (!result || result.success === false || !result.data)
              return null;
            const blobUrl = URL.createObjectURL(
              new Blob([result.data as any as ArrayBuffer], { type: mimeType }),
            );
            return { src: blobUrl, type: mediaType, title: sibling.name };
          }),
        )
      ).filter((s): s is NonNullable<typeof s> => s !== null);
      if (sources.length === 0) return;
      const clickedIndex = siblingMediaFiles.findIndex(
        (entry) => entry.path === node.path,
      );
      uiDispatch.openMediaPreview(sources, Math.max(0, clickedIndex));
    }
  };

  if (!isElectron()) {
    return <NoteListSidebar />;
  }

  if (!state.explorerRoot) {
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
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          Explorer
        </span>
        <div className="flex gap-1">
          <button
            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="New Note"
          >
            <PlusIcon size={14} />
          </button>
          <button
            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="New Folder"
          >
            <FolderPlusIcon size={14} />
          </button>
          <button
            className={`p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground ${showDbNotes ? "bg-muted text-foreground" : ""}`}
            title="Notes in database"
            onClick={() => setShowDbNotes((v) => !v)}
          >
            <GlobeSimpleIcon size={14} />
          </button>
        </div>
      </div>
      <div className="overflow-auto flex-1 scrollbar-hide">
        {showDbNotes ? (
          <DbNotesTree notes={state.notes} rootPath={state.explorerRoot} />
        ) : (
          <TreeView
            map={map}
            rootPath={state.explorerRoot}
            onFileSelect={onFileSelect}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
};
