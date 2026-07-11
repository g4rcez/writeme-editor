import { Button } from "@g4rcez/components";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { FolderPlusIcon } from "@phosphor-icons/react/dist/csr/FolderPlus";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TreeNode } from "@/types/tree";
import { isElectron } from "@/lib/is-electron";
import { globalDispatch, repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { useUIStore, type MediaSource } from "@/store/ui.store";
import { NoteListSidebar } from "../note-list/note-list-sidebar";
import { TreeView, type TreeCreateRequest } from "../tree-view";

type Mime = { mediaType: MediaSource["type"]; mimeType: string };

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
} satisfies Record<string, Mime>;

type EXTENSION_TYPE = keyof typeof MEDIA_EXTENSION_MAP;

export const ExplorerPane = () => {
    const [state] = useGlobalStore();
    const [, uiDispatch] = useUIStore();
    const [createRequest, setCreateRequest] = useState<TreeCreateRequest | null>(null);
    const map = new Map(state.notes.map((x) => [x.filePath!, x]));
    const navigate = useNavigate();

    const requestRootCreate = useCallback((kind: TreeCreateRequest["kind"]) => {
        setCreateRequest((previous) => ({
            id: (previous?.id ?? 0) + 1,
            kind,
        }));
    }, []);

    const handleNewFile = useCallback(
        async (targetPath: string): Promise<boolean> => {
            try {
                const writeResult = await window.electronAPI.fs.writeFile(targetPath, "");
                if (!writeResult?.success) return false;
                const title = targetPath.substring(targetPath.lastIndexOf("/") + 1).replace(/\.md$/, "");
                const note = Note.new(title, "");
                note.filePath = targetPath;
                await repositories.notes.save(note);
                const updatedNotes = await repositories.notes.getAll();
                globalDispatch.notes(updatedNotes);
                navigate(`/note/${note.id}`);
                return true;
            } catch {
                return false;
            }
        },
        [navigate],
    );

    const handleNewFolder = useCallback(async (targetPath: string): Promise<boolean> => {
        try {
            const result = await window.electronAPI.fs.mkdir(targetPath);
            return Boolean(result?.success);
        } catch {
            return false;
        }
    }, []);

    const handleMove = useCallback(
        async (sourceNode: TreeNode, _targetDirectoryPath: string, destinationPath: string): Promise<boolean> => {
            try {
                const result = await window.electronAPI.fs.moveFile(sourceNode.path, destinationPath);
                if (!result?.success) return false;

                const allNotes = await repositories.notes.getAll();
                const movedNotes = allNotes.filter((note) => {
                    if (!note.filePath) return false;
                    return sourceNode.type === "directory"
                        ? note.filePath === sourceNode.path || note.filePath.startsWith(sourceNode.path + "/")
                        : note.filePath === sourceNode.path;
                });

                for (const note of movedNotes) {
                    note.filePath =
                        sourceNode.type === "directory"
                            ? destinationPath + note.filePath!.slice(sourceNode.path.length)
                            : destinationPath;
                    await repositories.notes.save(note);
                }

                const updatedNotes = await repositories.notes.getAll();
                globalDispatch.notes(updatedNotes);
                const activeNote = state.note;
                if (activeNote?.filePath) {
                    const updatedActiveNote = updatedNotes.find((note) => note.id === activeNote.id);
                    if (updatedActiveNote) globalDispatch.setNote(updatedActiveNote);
                }
                return true;
            } catch (error) {
                console.error("Error moving:", error);
                return false;
            }
        },
        [state.note],
    );

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
                const notesInDir = allNotes.filter((n) => n.filePath?.startsWith(node.path + "/"));
                for (const note of notesInDir) {
                    await globalDispatch.deleteNote(note.id);
                }
            }
            const result = await window.electronAPI.fs.deleteFile(node.path);
            return typeof result === "object" && result !== null ? result.success : result === true;
        } catch (error) {
            console.error("Error deleting:", error);
            return false;
        }
    }, []);

    const handleTreeRootContextMenu = useCallback(
        (e: React.MouseEvent) => {
            if (!state.explorerRoot) return;
            e.preventDefault();
            window.electronAPI.contextMenu.showExplorer(state.explorerRoot, true);
        },
        [state.explorerRoot],
    );

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
                note = Note.new(node.name.replace(".json", ""), result.content || "", NoteType.json);
                note.filePath = node.path;
                await repositories.notes.save(note);
                const updatedNotes = await repositories.notes.getAll();
                globalDispatch.notes(updatedNotes);
            }
            navigate(`/note/${note.id}`);
        } else if (node.type === "file" && node.extension && MEDIA_EXTENSION_MAP[node.extension as EXTENSION_TYPE]) {
            const parentDir = node.path.substring(0, node.path.lastIndexOf("/"));
            const dirResult = await window.electronAPI.fs.readDir(parentDir);
            const siblingMediaFiles = (dirResult?.entries ?? []).filter(
                (entry) =>
                    entry.type === "file" && entry.extension && MEDIA_EXTENSION_MAP[entry.extension as EXTENSION_TYPE],
            );
            const sources = (
                await Promise.all(
                    siblingMediaFiles.map(async (sibling) => {
                        const { mediaType, mimeType } = MEDIA_EXTENSION_MAP[sibling.extension! as EXTENSION_TYPE];
                        const result = await window.electronAPI.fs.readBinaryFile(sibling.path);
                        if (!result || result.success === false || !result.data) return null;
                        const blobUrl = URL.createObjectURL(
                            new Blob([result.data as any as ArrayBuffer], { type: mimeType }),
                        );
                        return { src: blobUrl, type: mediaType, title: sibling.name };
                    }),
                )
            ).filter((s): s is NonNullable<typeof s> => s !== null);
            if (sources.length === 0) return;
            const clickedIndex = siblingMediaFiles.findIndex((entry) => entry.path === node.path);
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
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
                <span className="text-xs text-muted-foreground">Files</span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Create file"
                        aria-label="Create file"
                        onClick={() => requestRootCreate("file")}
                    >
                        <FilePlusIcon size={14} />
                    </button>
                    <button
                        type="button"
                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Create folder"
                        aria-label="Create folder"
                        onClick={() => requestRootCreate("directory")}
                    >
                        <FolderPlusIcon size={14} />
                    </button>
                </div>
            </div>
            <div
                data-treeroot="true"
                onContextMenu={handleTreeRootContextMenu}
                className="min-h-0 flex-1 overflow-auto pb-0 scrollbar-hide"
            >
                <TreeView
                    map={map}
                    onMove={handleMove}
                    onDelete={handleDelete}
                    onNewFile={handleNewFile}
                    onFileSelect={onFileSelect}
                    createRequest={createRequest}
                    onNewFolder={handleNewFolder}
                    rootPath={state.explorerRoot}
                />
            </div>
        </div>
    );
};
