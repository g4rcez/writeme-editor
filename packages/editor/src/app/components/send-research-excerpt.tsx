import { Button, Input, Modal } from "@g4rcez/components";
import { useEffect, useId, useRef, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { isPathWithinImportRoot } from "@/lib/obsidian-import";
import {
    captureResearchSelection,
    createResearchExcerpt,
    isResearchDestination,
    saveResearchExcerpt,
    type ResearchExcerptSource,
} from "@/lib/research-excerpt";
import { getWorkspaceKey, globalDispatch, globalState, repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { useUIStore } from "@/store/ui.store";

type Props = { source: ResearchExcerptSource };

export function SendResearchExcerpt({ source }: Props): JSX.Element {
    const [state] = useGlobalStore();
    const [open, setOpen] = useState(false);
    const [excerpt, setExcerpt] = useState("");
    const [quotationText, setQuotationText] = useState("");
    const [attribution, setAttribution] = useState("");
    const destinationControlId = useId();
    const [destinationId, setDestinationId] = useState("");
    const [createNew, setCreateNew] = useState(false);
    const [title, setTitle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const capture = useRef<{ text: string; source: ResearchExcerptSource } | null>(null);
    const actionCapture = useRef<{ text: string; source: ResearchExcerptSource } | null>(null);
    const operation = useRef("");
    const newNote = useRef<Note | null>(null);
    const inFlight = useRef(false);
    const button = useRef<HTMLButtonElement>(null);
    const navigate = useNavigate();
    const destinations = state.notes.filter(
        (note) =>
            isResearchDestination(note, source.note.id) &&
            (note.filePath
                ? !!state.directory && isPathWithinImportRoot(state.directory, note.filePath)
                : note.project === getWorkspaceKey(state.directory) ||
                  (!state.directory && ["", "default"].includes(note.project))),
    );

    useEffect(() => {
        const remember = (): void => {
            const selection = window.getSelection();
            const selectedSource = captureResearchSelection(source, selection);
            capture.current =
                selectedSource && selection ? { text: selection.toString(), source: selectedSource } : null;
        };
        document.addEventListener("selectionchange", remember);
        return () => document.removeEventListener("selectionchange", remember);
    }, [source]);

    function close(): void {
        if (inFlight.current) return;
        setOpen(false);
        button.current?.focus();
    }

    async function send(): Promise<void> {
        if (inFlight.current) return;
        inFlight.current = true;
        setError(null);
        setSaving(true);
        try {
            let destination: Note | null = null;
            if (createNew) {
                if (!title.trim()) throw new Error("Enter a title for the destination note.");
                if (/[/\\]/.test(title) || [".", ".."].includes(title.trim()))
                    throw new Error("Enter a note title without a folder path.");
                newNote.current ??= Note.new(title.trim(), `${excerpt}\n`, NoteType.note);
                const existing = await repositories.notes.getOne(newNote.current.id);
                destination = existing ?? (await repositories.notes.save(newNote.current));
            } else {
                if (!destinationId) throw new Error("Choose a destination note.");
                const status = useUIStore.getState().noteSaveStatuses[destinationId];
                if (status && status !== "saved")
                    throw new Error(
                        "Save the destination note's pending edits before sending this excerpt, then retry.",
                    );
                destination = await saveResearchExcerpt(
                    repositories.notes,
                    destinationId,
                    excerpt,
                    operation.current,
                    source.note.id,
                );
            }
            if (!destination) throw new Error("Could not find the destination note. Try again.");
            const current = globalState();
            globalDispatch.notes([...current.notes.filter((note) => note.id !== destination.id), destination]);
            if (current.note?.id === destination.id) globalDispatch.setNote(destination);
            await globalDispatch.addTab(destination.id);
            setOpen(false);
            navigate(`/note/${destination.id}`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not send this excerpt. Retry.");
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    function startCapture(): void {
        const activeSelection = window.getSelection();
        const selectedSource = captureResearchSelection(source, activeSelection);
        const frozenSelection = actionCapture.current;
        actionCapture.current = null;
        const selected =
            selectedSource && activeSelection
                ? { text: activeSelection.toString(), source: selectedSource }
                : (frozenSelection ?? capture.current);
        if (!selected) {
            setError("Select text in this source before sending it to a note.");
            return;
        }
        operation.current = crypto.randomUUID();
        newNote.current = null;
        const quotation = createResearchExcerpt(selected.text, selected.source, operation.current);
        setExcerpt(quotation);
        setQuotationText(selected.text.trim());
        setAttribution(`${source.note.title}${selected.source.kind === "pdf" ? `, p. ${selected.source.page}` : ""}`);
        setError(null);
        setDestinationId("");
        setCreateNew(false);
        setTitle("");
        setOpen(true);
    }

    return (
        <>
            {source.kind === "pdf" ? (
                <Button
                    type="button"
                    theme="muted"
                    className="min-h-11"
                    onClick={() => {
                        const root = document.querySelector(
                            `[data-research-source="${CSS.escape(source.note.id)}"] .wm-pdf-text-layer`,
                        );
                        if (!root?.textContent?.trim()) {
                            setError(
                                "This page has no selectable text. Scanned PDFs need text added before excerpts can be captured.",
                            );
                            return;
                        }
                        const range = document.createRange();
                        range.selectNodeContents(root);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                        startCapture();
                    }}
                >
                    Select page text
                </Button>
            ) : null}
            <Button
                ref={button}
                type="button"
                theme="muted"
                className="min-h-11"
                aria-label="Send selection to note"
                onPointerDown={() => {
                    const selection = window.getSelection();
                    const selectedSource = captureResearchSelection(source, selection);
                    actionCapture.current =
                        selectedSource && selection
                            ? { text: selection.toString(), source: selectedSource }
                            : capture.current;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={startCapture}
            >
                Send selection to note
            </Button>
            {!open && error ? (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            ) : null}
            <Modal
                open={open}
                title="Send selection to note"
                onChange={(value) => {
                    if (!value) close();
                }}
                className="max-w-md"
                style={{ maxHeight: "calc(100dvh - 2rem)" }}
                bodyClassName="min-h-0"
                footer={
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" theme="muted" className="min-h-11" onClick={close} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="min-h-11"
                            onClick={() => void send()}
                            disabled={saving}
                            loading={saving}
                        >
                            Send excerpt
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4 p-4">
                    <p className="text-sm text-muted-foreground">
                        Add this quotation to a note. The source text will remain unchanged.
                    </p>
                    <blockquote className="max-h-32 overflow-auto whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-foreground">
                        {quotationText}
                    </blockquote>
                    <p className="text-sm text-muted-foreground">{attribution}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            theme={createNew ? "primary" : "muted"}
                            aria-pressed={createNew}
                            disabled={saving}
                            onClick={() => setCreateNew(true)}
                        >
                            Create a note
                        </Button>
                        <Button
                            type="button"
                            theme={!createNew ? "primary" : "muted"}
                            aria-pressed={!createNew}
                            disabled={saving}
                            onClick={() => setCreateNew(false)}
                        >
                            Choose existing note
                        </Button>
                    </div>
                    {createNew ? (
                        <label htmlFor={destinationControlId} className="flex flex-col gap-1 text-sm text-foreground">
                            Destination note title
                            <Input
                                id={destinationControlId}
                                disabled={saving}
                                aria-label="Destination note title"
                                value={title}
                                onChange={(event) => {
                                    setTitle(event.target.value);
                                    newNote.current = null;
                                }}
                                placeholder="Note title"
                            />
                        </label>
                    ) : (
                        <label htmlFor={destinationControlId} className="flex flex-col gap-1 text-sm text-foreground">
                            Destination note
                            <select
                                id={destinationControlId}
                                aria-label="Destination note"
                                disabled={saving}
                                className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={destinationId}
                                onChange={(event) => setDestinationId(event.target.value)}
                            >
                                <option value="">Choose a note…</option>
                                {destinations.map((note) => (
                                    <option key={note.id} value={note.id}>
                                        {note.title || "Untitled"}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {!createNew && !destinations.length ? (
                        <p className="text-sm text-muted-foreground">
                            No writing notes yet. Create a note for this excerpt.
                        </p>
                    ) : null}
                    {error ? (
                        <p role="alert" className="text-sm text-danger">
                            {error}
                        </p>
                    ) : null}
                </div>
            </Modal>
        </>
    );
}
