import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isElectron } from "@/lib/is-electron";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";

type FileEntry = { name: string; path: string; relativePath: string };

export default function FolderWorkspacePage() {
    const [searchParams] = useSearchParams();
    const folderPath = searchParams.get("path") ?? "";
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [, dispatch] = useGlobalStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isElectron() || !folderPath) {
            setLoading(false);
            return;
        }
        window.electronAPI.fs
            .readDirRecursive(folderPath)
            .then((result) => {
                if (result.success) {
                    setFiles(result.files);
                }
            })
            .finally(() => setLoading(false));
    }, [folderPath]);

    if (!isElectron()) return null;

    const openFile = async (filePath: string) => {
        try {
            const existing = await window.electronAPI.db.notes.getByFilePath(filePath);
            let noteId: string;
            if (existing) {
                noteId = existing.id;
            } else {
                const result = await window.electronAPI.fs.readFile(filePath);
                if (!result.success || typeof result.content !== "string") {
                    throw new Error(result.error ?? "Failed to read file");
                }
                const basename = filePath.split(/[\\/]/).pop() ?? filePath;
                const title = basename.replace(/\.[^.]+$/, "");
                const note = Note.new(title, result.content);
                note.setFilePath(filePath, result.lastModified ? new Date(result.lastModified) : note.updatedAt);
                note.fileSize = typeof result.fileSize === "number" ? result.fileSize : result.content.length;
                await repositories.notes.save(note);
                noteId = note.id;
            }
            await dispatch.selectNoteById(noteId);
            navigate(`/note/${noteId}`);
        } catch (err) {
            console.error("Failed to open file from folder workspace:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground">
                Reading folder...
            </div>
        );
    }

    return (
        <section className="writeme-folder-page mx-auto min-h-full w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
            <header className="border-b border-border/45 pb-6">
                <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                    <FolderOpenIcon size={14} aria-hidden="true" />
                    Folder workspace
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <h1
                        className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                        title={folderPath}
                    >
                        {folderPath}
                    </h1>
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {files.length} {files.length === 1 ? "file" : "files"}
                    </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    Markdown files in this folder. Open one to add it to your workspace.
                </p>
            </header>
            {files.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FolderOpenIcon size={20} aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-medium text-foreground">No markdown files found.</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Add a Markdown file to this folder and it will appear here.
                    </p>
                </div>
            ) : (
                <ul className="mt-5 overflow-hidden rounded-xl border border-border/45 bg-card-background">
                    {files.map((file) => (
                        <li key={file.path} className="border-b border-border/35 last:border-b-0">
                            <button
                                type="button"
                                onClick={() => openFile(file.path)}
                                className="group flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-4 sm:px-5"
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                    <FileTextIcon size={16} aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground group-hover:text-primary">
                                    {file.relativePath}
                                </span>
                                <ArrowRightIcon
                                    size={16}
                                    className="shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                                    aria-hidden="true"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
