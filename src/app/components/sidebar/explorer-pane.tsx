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
        if (node.type === "file" && (node.extension === ".md" || node.extension === ".mdx")) {
            const allNotes = await repositories.notes.getAll();
            let note = allNotes.find((n) => n.filePath === node.path);
            if (!note) {
                const result = await window.electronAPI.fs.readFile(node.path);
                note = Note.new(node.name.replace(/\.(?:md|mdx)$/i, ""), result.content || "");
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
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FolderOpenIcon size={23} aria-hidden="true" />
                </div>
                <div className="max-w-[220px]">
                    <h3 className="text-sm font-semibold text-foreground">Open a workspace folder</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Browse local Markdown files alongside your notes.
                    </p>
                </div>
                <Button onClick={handleChooseDirectory} size="small" className="w-full max-w-[220px]">
                    Open folder
                </Button>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border/40 px-1 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <FolderOpenIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate text-xs font-medium text-foreground">Files</span>
                </div>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Create file"
                        aria-label="Create file"
                        onClick={() => requestRootCreate("file")}
                    >
                        <FilePlusIcon size={15} />
                    </button>
                    <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Create folder"
                        aria-label="Create folder"
                        onClick={() => requestRootCreate("directory")}
                    >
                        <FolderPlusIcon size={15} />
                    </button>
                </div>
            </div>
            <div
                data-treeroot="true"
                onContextMenu={handleTreeRootContextMenu}
                className="writeme-sidebar-v2-tree min-h-0 flex-1 overflow-auto pb-2 scrollbar-hide"
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
