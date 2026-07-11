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
                const content = await window.electronAPI.fs.readFile(filePath).catch(() => "");
                const basename = filePath.split(/[\\/]/).pop() ?? filePath;
                const title = basename.replace(/\.[^.]+$/, "");
                const note = Note.new(title, typeof content === "string" ? content : "");
                note.setFilePath(filePath, new Date());
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
        return <div className="flex justify-center items-center w-full h-full">Loading files...</div>;
    }

    return (
        <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
            <h1 className="text-2xl font-bold mb-6 truncate">{folderPath}</h1>
            {files.length === 0 ? (
                <p className="text-foreground/50">No markdown files found.</p>
            ) : (
                <ul className="space-y-1">
                    {files.map((file) => (
                        <li key={file.path}>
                            <button
                                onClick={() => openFile(file.path)}
                                className="w-full text-left px-3 py-2 rounded transition-colors hover:bg-muted/30 text-foreground hover:text-primary truncate"
                            >
                                {file.relativePath}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
