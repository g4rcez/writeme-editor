import { DownloadSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useRef, useState, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { editorSearchGlobalRef } from "@/app/editor-global-ref";
import { YAML } from "@/lib/encoding";
import { exportFile } from "@/lib/export-file";
import { readPdfAsset } from "@/lib/pdf-import";
import { parsePdfNote } from "@/lib/pdf-note";
import { useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { repositories } from "@/store/repositories";
import { uiDispatch } from "@/store/ui.store";

export function MobileFileActions(): JSX.Element {
    const fileInput = useRef<HTMLInputElement>(null);
    const [state, dispatch] = useGlobalStore();
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const activeNote = state.note && /^\/(?:note|quicknote)\//.test(location.pathname) ? state.note : null;

    const reportError = (error: unknown): void => {
        uiDispatch.setError(error instanceof Error ? error.message : "Could not transfer the note.");
    };

    return (
        <>
            <input
                ref={fileInput}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                aria-label="Import Markdown file"
                className="hidden"
                onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    setBusy(true);
                    try {
                        const content = await file.text();
                        const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
                        const metadata: unknown = frontmatter ? YAML.parse(frontmatter) : null;
                        const type =
                            metadata && typeof metadata === "object" && "type" in metadata ? metadata.type : undefined;
                        const noteType = Object.values(NoteType).find((value) => value === type) ?? NoteType.note;
                        const note = Note.new(file.name.replace(/\.(md|markdown)$/i, ""), content, noteType);
                        await repositories.notes.save(note);
                        await dispatch.note(note);
                        navigate(`/note/${note.id}`);
                        uiDispatch.setSidebarOpen(false);
                    } catch (error) {
                        reportError(error);
                    } finally {
                        setBusy(false);
                    }
                }}
            />
            <button
                type="button"
                className="writeme-header-action"
                aria-label="Import Markdown"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
            >
                <UploadSimpleIcon size={17} aria-hidden="true" />
            </button>
            {activeNote && (
                <button
                    type="button"
                    className="writeme-header-action"
                    aria-label={activeNote.noteType === NoteType.pdf ? "Export original PDF" : "Export note"}
                    disabled={busy}
                    onClick={async () => {
                        const note = activeNote;
                        if (!note) return;
                        setBusy(true);
                        try {
                            if (note.noteType === NoteType.pdf) {
                                const notebook = parsePdfNote(note.content);
                                const data = await readPdfAsset(note, notebook);
                                await exportFile(
                                    notebook.pdf.filename,
                                    new Blob([new Uint8Array(data)], { type: "application/pdf" }),
                                );
                            } else {
                                const content = editorSearchGlobalRef.current?.getContent() ?? note.content;
                                await exportFile(
                                    `${note.title}.md`,
                                    new Blob([content], { type: "text/markdown;charset=utf-8" }),
                                );
                            }
                        } catch (error) {
                            reportError(error);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <DownloadSimpleIcon size={17} aria-hidden="true" />
                </button>
            )}
            {busy && <output className="text-xs text-muted-foreground">Transferring...</output>}
        </>
    );
}
