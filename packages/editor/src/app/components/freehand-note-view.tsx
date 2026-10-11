import { Button, Modal } from "@g4rcez/components";
import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";
import type { Note } from "@/store/note";
import { parseFreehandNote, replaceFreehandNoteContent, type FreehandNotebook } from "@/lib/freehand-note";
import { isPathWithinImportRoot } from "@/lib/obsidian-import";
import { exportFile } from "@/lib/export-file";
import { getWorkspaceKey, globalDispatch, globalState, repositories, useGlobalStore } from "@/store/global.store";
import { uiDispatch } from "@/store/ui.store";
import { FreehandCanvas } from "./freehand-canvas";

class NotebookConflict extends Error {}

export function FreehandNoteView({
    note,
    actions,
    pageBackground,
    fixedPages = false,
}: {
    note: Note;
    actions?: ReactNode;
    pageBackground?: (pageIndex: number, zoom: number) => ReactNode;
    fixedPages?: boolean;
}): JSX.Element {
    const [state] = useGlobalStore();
    const workspaceKey = getWorkspaceKey(state.directory);
    const linkableNotes = state.notes.filter((item) => {
        if (item.id === note.id || item.deletedAt) return false;
        if (item.filePath) return state.directory !== null && isPathWithinImportRoot(state.directory, item.filePath);
        return item.project === workspaceKey || (!state.directory && ["", "default"].includes(item.project));
    });
    useEffect(() => {
        uiDispatch.setSidebarOpen(false);
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const [parsed] = useState(() => {
        try {
            return { data: parseFreehandNote(note.content), error: null };
        } catch {
            return {
                data: null,
                error: "This handwritten note could not be loaded. Its original content has been kept.",
            };
        }
    });
    const [status, setStatus] = useState<"Saved" | "Saving…" | "Could not save">("Saved");
    const [notice, setNotice] = useState<string | null>(null);
    const pending = useRef(Promise.resolve());
    const revision = useRef(0);
    const latest = useRef(parsed.data);
    const persisted = useRef(note);
    const mounted = useRef(true);
    const blocker = useBlocker(status !== "Saved");

    useEffect(() => {
        if (status === "Saved" && blocker.state === "blocked") blocker.proceed();
    }, [status, blocker]);

    useEffect(() => {
        if (status === "Saved") return;
        const beforeUnload = (event: BeforeUnloadEvent): void => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [status]);

    function save(data: FreehandNotebook): void {
        latest.current = data;
        const currentRevision = ++revision.current;
        setStatus("Saving…");
        pending.current = pending.current.then(async () => {
            try {
                const existing = await repositories.notes.getOne(note.id);
                if (!existing || existing.content !== persisted.current.content) throw new NotebookConflict();
                const content = replaceFreehandNoteContent(existing.content, data);
                const updated = await repositories.notes.updateContentIfUnchanged(note.id, existing, content);
                if (!updated) throw new NotebookConflict();
                persisted.current = updated;
                const state = globalState();
                globalDispatch.notes(state.notes.map((item) => (item.id === note.id ? updated : item)));
                if (state.note?.id === note.id) globalDispatch.setNote(updated);
                if (mounted.current && revision.current === currentRevision) {
                    setStatus("Saved");
                    setNotice(null);
                }
            } catch (reason) {
                if (mounted.current && revision.current === currentRevision) {
                    setStatus("Could not save");
                    setNotice(
                        reason instanceof NotebookConflict
                            ? "This notebook changed in another editor. Your local changes are kept here. Download a copy before reopening the saved version."
                            : "Could not save this notebook. Your local changes are kept here. Retry or download a copy.",
                    );
                }
            }
        });
    }

    function downloadLocalCopy(): void {
        if (!latest.current) return;
        const content = replaceFreehandNoteContent(persisted.current.content, latest.current);
        void exportFile(`${note.title || "Notebook"}-local-copy.md`, new Blob([content], { type: "text/markdown;charset=utf-8" }))
            .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not export the local copy."));
    }

    if (!parsed.data)
        return (
            <div className="p-6 text-foreground" role="alert">
                {parsed.error}
            </div>
        );
    return (
        <div className="wm-notebook-view">
            <FreehandCanvas
                pageBackground={pageBackground}
                fixedPages={fixedPages}
                title={note.title}
                actions={actions}
                linkableNotes={linkableNotes}
                initialData={parsed.data}
                onChange={save}
                saveStatus={status}
                onRetry={() => {
                    if (latest.current) save(latest.current);
                }}
            />
            {notice && (
                <aside className="wm-notebook-notice" role="alert">
                    <p>{notice}</p>
                    <button type="button" className="wm-ink-control" onClick={downloadLocalCopy}>
                        Download local copy
                    </button>
                </aside>
            )}
            <Modal
                open={blocker.state === "blocked"}
                title="Unsaved notebook"
                onChange={() => {
                    if (blocker.state === "blocked") blocker.reset();
                }}
                className="max-w-md"
            >
                <p>
                    {status === "Saving…"
                        ? "Your ink is being saved. This page will open when saving finishes."
                        : "Your latest changes have not been saved. Stay here to retry or download a copy."}
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button
                        className="min-h-11"
                        onClick={() => {
                            if (blocker.state === "blocked") blocker.reset();
                        }}
                    >
                        Stay in notebook
                    </Button>
                    <Button theme="muted" className="min-h-11" onClick={downloadLocalCopy}>
                        Download local copy
                    </Button>
                    <Button
                        theme="muted"
                        className="min-h-11"
                        disabled={status === "Saving…"}
                        onClick={() => {
                            if (blocker.state === "blocked") blocker.proceed();
                        }}
                    >
                        Leave without saving
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
