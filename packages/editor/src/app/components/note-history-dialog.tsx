import { Button, Modal } from "@g4rcez/components";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "@/store/note";
import type { NoteSnapshot } from "@/store/note-history";
import { editorSearchGlobalRef } from "@/app/editor-global-ref";
import { notificationRef } from "@/app/notification-ref";
import { Dates } from "@/lib/dates";
import { repositories } from "@/store/repositories";

type NoteHistoryButtonProps = {
    onClick: () => void;
};

export function NoteHistoryButton({ onClick }: NoteHistoryButtonProps) {
    return (
        <Button
            type="button"
            size="icon"
            theme="ghost-muted"
            className="writeme-note-tool-button"
            aria-label="History"
            title="View note history"
            icon={<ClockCounterClockwiseIcon aria-hidden="true" />}
            onClick={onClick}
        />
    );
}

type NoteHistoryDialogProps = {
    note: Note;
    open: boolean;
    onClose: () => void;
    onRestored: (note: Note) => void;
};

export function formatSnapshotDate(snapshot: NoteSnapshot): string {
    return `${Dates.yearMonthDay(snapshot.createdAt)} ${Dates.time(snapshot.createdAt)}`;
}

export function NoteHistoryDialog({ note, open, onClose, onRestored }: NoteHistoryDialogProps) {
    const [snapshots, setSnapshots] = useState<NoteSnapshot[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmSnapshot, setConfirmSnapshot] = useState<NoteSnapshot | null>(null);
    const loadGeneration = useRef(0);

    const loadHistory = useCallback(async (): Promise<void> => {
        const generation = ++loadGeneration.current;
        setLoading(true);
        setError(null);
        try {
            const loaded = await repositories.notes.getHistory(note.id);
            if (generation !== loadGeneration.current) return;
            const ordered = [...loaded].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            setSnapshots(ordered);
            setSelectedId(ordered[0]?.id ?? null);
        } catch (reason) {
            if (generation !== loadGeneration.current) return;
            setSnapshots([]);
            setSelectedId(null);
            setError(reason instanceof Error ? reason.message : "Failed to load note history");
        } finally {
            if (generation === loadGeneration.current) setLoading(false);
        }
    }, [note.id]);

    useEffect(() => {
        if (!open) {
            loadGeneration.current += 1;
            return;
        }
        const timeout = setTimeout(() => void loadHistory(), 0);
        return () => {
            clearTimeout(timeout);
            loadGeneration.current += 1;
        };
    }, [loadHistory, open]);

    const selectedSnapshot = useMemo(
        () => snapshots.find((snapshot) => snapshot.id === selectedId) ?? snapshots[0] ?? null,
        [selectedId, snapshots],
    );
    let liveEditorContent: string | undefined;
    try {
        liveEditorContent = editorSearchGlobalRef.current?.getContent();
    } catch {
        liveEditorContent = undefined;
    }
    const currentContent = liveEditorContent ?? note.content;

    const requestRestore = (snapshot: NoteSnapshot): void => {
        if (restoring) return;
        setConfirmSnapshot(snapshot);
    };

    const restore = async (): Promise<void> => {
        if (!confirmSnapshot || restoring) return;
        const snapshot = confirmSnapshot;
        setConfirmSnapshot(null);
        setRestoring(true);
        setError(null);
        try {
            const restored = await repositories.notes.restoreSnapshot(note.id, snapshot.id);
            if (!restored) throw new Error("Failed to restore note history");
            onRestored(restored);
            await loadHistory();
            notificationRef.current?.(<span>Note restored from history.</span>, {
                theme: "success",
                closable: true,
                timeout: 4000,
            });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Failed to restore note history");
        } finally {
            setRestoring(false);
        }
    };

    return (
        <>
            <Modal
                open={open}
                onChange={(value) => {
                    if (!value && !restoring) {
                        setConfirmSnapshot(null);
                        onClose();
                    }
                }}
                title="Note history"
                className="max-w-4xl"
                bodyClassName="bg-background"
            >
                <div className="flex min-h-[28rem] flex-col gap-4" aria-busy={loading || restoring}>
                    <p className="text-sm text-muted-foreground">
                        Saved versions are stored locally. Select a version to preview it before restoring.
                    </p>

                    {confirmSnapshot ? (
                        <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded border border-card-border bg-secondary-background p-4">
                            <legend className="sr-only">Restore confirmation</legend>
                            <p className="text-sm text-foreground">
                                Restore the version from {formatSnapshotDate(confirmSnapshot)}? Your current content
                                will be preserved in local history.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button type="button" theme="ghost-muted" onClick={() => setConfirmSnapshot(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    theme="primary"
                                    disabled={restoring}
                                    onClick={() => void restore()}
                                >
                                    {restoring ? "Restoring…" : "Restore"}
                                </Button>
                            </div>
                        </fieldset>
                    ) : null}

                    {error ? (
                        <div className="flex items-center justify-between gap-3 rounded border border-danger/40 bg-danger-subtle p-3 text-sm">
                            <p role="alert">{error}</p>
                            <Button type="button" size="tiny" theme="ghost-muted" onClick={() => void loadHistory()}>
                                Retry
                            </Button>
                        </div>
                    ) : null}

                    {loading ? (
                        <output
                            aria-live="polite"
                            className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
                        >
                            Loading history…
                        </output>
                    ) : snapshots.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded border border-dashed border-card-border p-8 text-center">
                            <p className="text-sm text-muted-foreground">No saved versions yet.</p>
                        </div>
                    ) : (
                        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]">
                            <div className="min-h-0 overflow-y-auto rounded border border-card-border p-1">
                                <ul aria-label="Saved versions" className="flex flex-col gap-1">
                                    {snapshots.map((snapshot) => {
                                        const selected = snapshot.id === selectedSnapshot?.id;
                                        return (
                                            <li key={snapshot.id}>
                                                <button
                                                    type="button"
                                                    aria-current={selected ? "true" : undefined}
                                                    className={`w-full rounded-button-radius border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                                        selected
                                                            ? "border-primary/35 bg-primary/10 text-foreground"
                                                            : "border-transparent text-muted-foreground hover:border-card-border hover:bg-muted/40"
                                                    }`}
                                                    onClick={() => setSelectedId(snapshot.id)}
                                                >
                                                    <time dateTime={snapshot.createdAt.toISOString()}>
                                                        {formatSnapshotDate(snapshot)}
                                                    </time>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            {selectedSnapshot ? (
                                <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
                                    <section className="flex min-h-0 flex-col gap-3" aria-label="Current note">
                                        <div className="flex min-h-10 items-center text-sm">
                                            <div>
                                                <p className="font-medium text-foreground">Current note</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {liveEditorContent === undefined
                                                        ? "Last saved content"
                                                        : "Live editor content"}
                                                </p>
                                            </div>
                                        </div>
                                        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded border border-card-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground">
                                            {currentContent}
                                        </pre>
                                    </section>
                                    <section className="flex min-h-0 flex-col gap-3" aria-label="Saved version preview">
                                        <div className="flex min-h-10 items-center justify-between gap-3 text-sm">
                                            <div className="min-w-0">
                                                <p className="font-medium text-foreground">Saved version</p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {formatSnapshotDate(selectedSnapshot)}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                theme="primary"
                                                disabled={restoring}
                                                onClick={() => requestRestore(selectedSnapshot)}
                                            >
                                                {restoring ? "Restoring…" : "Restore"}
                                            </Button>
                                        </div>
                                        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded border border-card-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground">
                                            {selectedSnapshot.content}
                                        </pre>
                                    </section>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}
