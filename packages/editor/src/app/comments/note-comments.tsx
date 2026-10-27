import type { Editor } from "@tiptap/core";
import type { SelectionBookmark, Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Button } from "@g4rcez/components";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { v7 as uuid } from "uuid";
import { getEditorMarkdown } from "@/lib/editor-storage";
import { isElectron } from "@/lib/is-electron";
import { getCommentCompanion, getCommentId, parseCommentThreads } from "@/lib/note-comments";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { FormattingToolbar } from "../components/formatting-toolbar";
import { loadCommentNote, saveNoteComment } from "./comment-repository";

type Anchor = { id: string; from: number; to: number; text: string };
type Draft = {
    id: string | null;
    quote: string;
    bookmark: SelectionBookmark;
    saved?: boolean;
    operationId: string;
    href?: string;
};
type Props = {
    editor: Editor;
    note: Note;
    readonly: boolean;
    onSaveSource: (content: string, referenceHref?: string) => Promise<void>;
    onSourcePersisted: (note: Note) => void;
};

const anchorCache = new WeakMap<ProseMirrorNode, { context: string; anchors: Anchor[] }>();

export function getCommentAnchors(editor: { state: { doc: ProseMirrorNode } }, note: Note): Anchor[] {
    const aliases = note.metadata.commentReferenceHrefs;
    const context = JSON.stringify([getCommentCompanion(note).href,
        Array.isArray(aliases) ? aliases.filter((value): value is string => typeof value === "string") : []]);
    const cached = anchorCache.get(editor.state.doc);
    if (cached?.context === context) return cached.anchors;
    const anchors: Anchor[] = [];
    editor.state.doc.descendants((node, position) => {
        if (!node.isText) return;
        const link = node.marks.find((mark) => mark.type.name === "link");
        const id = getCommentId(link?.attrs.href, note);
        if (!id || !node.marks.some((mark) => mark.type.name === "highlight")) return;
        const last = anchors.at(-1);
        const between = last ? editor.state.doc.textBetween(last.to, position, "\n", "\n") : "";
        if (
            last?.id === id &&
            !between.trim() &&
            editor.state.doc.resolve(last.from).sameParent(editor.state.doc.resolve(position))
        ) {
            last.to = position + node.nodeSize;
            last.text += between + (node.text ?? "");
        } else anchors.push({ id, from: position, to: position + node.nodeSize, text: node.text ?? "" });
    });
    anchorCache.set(editor.state.doc, { context, anchors });
    return anchors;
}

export function NoteComments({ editor, note, readonly, onSaveSource, onSourcePersisted }: Props): JSX.Element {
    const [state, dispatch] = useGlobalStore((state) => ({ notes: state.notes }));
    const navigate = useNavigate();
    const inputId = useId();
    const panelId = useId();
    const [companion, setCompanion] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [loadRevision, setLoadRevision] = useState(0);
    const noteRef = useRef(note);
    noteRef.current = note;
    const loadErrorRef = useRef<string | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [open, setOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const draftRef = useRef<Draft | null>(null);
    const [composing, setComposing] = useState(false);
    const [draftQuote, setDraftQuote] = useState("");
    const [sourceSavePending, setSourceSavePending] = useState(false);
    const [body, setBody] = useState("");
    const [revision, setRevision] = useState(0);
    const [editorDocument, setEditorDocument] = useState(editor.state.doc);
    const panelRef = useRef<HTMLElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const listedCompanion = state.notes.find((entry) => entry.id === companion?.id);
    const savedCompanion =
        listedCompanion && (!companion || listedCompanion.updatedAt > companion.updatedAt)
            ? listedCompanion
            : companion;
    const threads = useMemo(() => parseCommentThreads(savedCompanion?.content ?? ""), [savedCompanion?.content]);
    const anchors = useMemo(() => getCommentAnchors({ state: { doc: editorDocument } }, note), [editorDocument, note]);
    const thread = threads.find((entry) => entry.id === activeId);
    const anchor = anchors.find((entry) => entry.id === activeId);

    const close = useCallback((): void => {
        if (busyRef.current || draftRef.current?.saved) return;
        setOpen(false);
        setComposing(false);
        setBody("");
        setDraftQuote("");
        setSourceSavePending(false);
        draftRef.current = null;
        editor.commands.focus();
    }, [editor]);

    const beginComment = useCallback((): void => {
        if (
            readonly ||
            busyRef.current ||
            draftRef.current?.saved ||
            editor.isActive("codeBlock") ||
            editor.isActive("code")
        )
            return;
        const selection = editor.state.selection;
        if (selection.empty) return;
        if (!selection.$from.sameParent(selection.$to)) {
            setError("Select text within one paragraph to add a comment.");
            setOpen(true);
            return;
        }
        const quote = editor.state.doc.textBetween(selection.from, selection.to, "\n", "\n");
        if (!quote.trim()) return;
        const currentAnchors = getCommentAnchors(editor, note);
        const containing = currentAnchors.find((entry) => selection.from >= entry.from && selection.to <= entry.to);
        let unsupported = false;
        editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
            if (node.isInline && !node.isText && node.type.name !== "hardBreak") unsupported = true;
            if (
                node.marks.some(
                    (mark) =>
                        mark.type.name === "code" ||
                        (mark.type.name === "link" && !getCommentId(mark.attrs.href, note)),
                )
            )
                unsupported = true;
        });
        if (unsupported) {
            setError("Select text without an existing link, code, or embedded content to add a comment.");
            setOpen(true);
            return;
        }
        if (!containing && currentAnchors.some((entry) => entry.from < selection.to && entry.to > selection.from)) {
            setError("Select the highlighted text to reply, or choose text outside an existing comment.");
            setOpen(true);
            return;
        }
        draftRef.current = {
            operationId: uuid(),
            id: containing?.id ?? null,
            quote: containing?.text ?? quote,
            bookmark: selection.getBookmark(),
        };
        setActiveId(containing?.id ?? null);
        setDraftQuote(containing?.text ?? quote);
        setSourceSavePending(false);
        setBody("");
        setError("");
        setComposing(true);
        setOpen(true);
    }, [editor, note, readonly]);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        const loaded = (reference: Note | null): void => {
            if (cancelled) return;
            const loadError = loadErrorRef.current;
            if (loadError) setError((current) => (current === loadError ? "" : current));
            loadErrorRef.current = null;
            setCompanion(reference);
            setLoadFailed(false);
            setLoading(false);
            if (reference) dispatch.syncNoteFromRepository(reference);
        };
        const failed = (reason: unknown): void => {
            if (cancelled) return;
            const message = reason instanceof Error ? reason.message : "Could not load comments.";
            loadErrorRef.current = message;
            setError(message);
            setLoadFailed(true);
            setLoading(false);
        };
        const source = noteRef.current;
        if (isElectron()) void loadCommentNote(source).then(loaded, failed);
        else
            void Promise.all([import("dexie"), import("@/store/repositories/browser/comments.repository")]).then(
                ([{ liveQuery }, { loadBrowserCommentNote }]) => {
                    if (cancelled) return;
                    const subscription = liveQuery(() => loadBrowserCommentNote(source, true)).subscribe({
                        next: loaded,
                        error: failed,
                    });
                    unsubscribe = () => subscription.unsubscribe();
                },
                failed,
            );
        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [note.id, note.filePath, note.title, note.project, dispatch, loadRevision]);

    useEffect(() => {
        const update = ({ transaction }: { transaction: Transaction }): void => {
            if (draftRef.current) draftRef.current.bookmark = draftRef.current.bookmark.map(transaction.mapping);
            if (transaction.docChanged) {
                setEditorDocument(editor.state.doc);
                setRevision((value) => value + 1);
            }
        };
        const selection = (): void => {
            if (draftRef.current || busyRef.current) return;
            const position = editor.state.selection.from;
            const selected = getCommentAnchors(editor, note).find(
                (entry) => entry.from <= position && entry.to >= position,
            );
            if (selected) {
                setActiveId(selected.id);
                setOpen(true);
            }
        };
        const click = (event: Event): void => {
            if (
                !(event instanceof CustomEvent) ||
                typeof event.detail !== "string" ||
                busyRef.current ||
                draftRef.current
            )
                return;
            draftRef.current = null;
            setComposing(false);
            setBody("");
            setDraftQuote("");
            setSourceSavePending(false);
            setActiveId(event.detail);
            setOpen(true);
        };
        const keydown = (event: KeyboardEvent): void => {
            if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === "m") {
                event.preventDefault();
                beginComment();
            }
        };
        let detachViewListeners: (() => void) | null = null;
        const attachViewListeners = (): void => {
            if (!editor.isInitialized || editor.isDestroyed || detachViewListeners) return;
            editor.on("transaction", update);
            editor.on("selectionUpdate", selection);
            const view = editor.view;
            view.dom.addEventListener("writeme:open-comment", click);
            view.dom.addEventListener("keydown", keydown);
            detachViewListeners = () => {
                editor.off("transaction", update);
                editor.off("selectionUpdate", selection);
                view.dom.removeEventListener("writeme:open-comment", click);
                view.dom.removeEventListener("keydown", keydown);
            };
        };
        const onCreate = (): void => {
            queueMicrotask(attachViewListeners);
        };
        editor.on("create", onCreate);
        attachViewListeners();
        return () => {
            editor.off("create", onCreate);
            detachViewListeners?.();
        };
    }, [editor, note, beginComment]);

    useEffect(() => {
        const escape = (event: KeyboardEvent): void => {
            if (
                open &&
                event.key === "Escape" &&
                event.target instanceof Node &&
                (panelRef.current?.contains(event.target) || editor.view.dom.contains(event.target))
            ) {
                event.stopPropagation();
                close();
            }
        };
        document.addEventListener("keydown", escape);
        return () => document.removeEventListener("keydown", escape);
    }, [close, editor, open]);

    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!open || !panel) return;
        const container = editor.view.dom.closest<HTMLElement>(".writeme-editor");
        if (!container) return;
        const positionPanel = (): void => {
            if (editor.isDestroyed) return;
            const position =
                draftRef.current?.bookmark.resolve(editor.state.doc).from ??
                anchor?.from ??
                (activeId ? editor.state.selection.from : undefined);
            const bounds = container.getBoundingClientRect();
            const top = position === undefined ? 8 : editor.view.coordsAtPos(position).bottom - bounds.top + 8;
            panel.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.top - panel.offsetHeight - 8))}px`;
        };
        positionPanel();
        const frame = requestAnimationFrame(positionPanel);
        const observer = new ResizeObserver(positionPanel);
        observer.observe(container);
        observer.observe(editor.view.dom);
        observer.observe(panel);
        window.addEventListener("scroll", positionPanel, { capture: true, passive: true });
        window.addEventListener("resize", positionPanel);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("scroll", positionPanel, true);
            window.removeEventListener("resize", positionPanel);
        };
    }, [open, editor, anchor?.from, composing, activeId, revision, busy, loading, body]);

    useEffect(() => {
        if (composing) inputRef.current?.focus();
    }, [composing]);

    async function save(): Promise<void> {
        const draft = draftRef.current;
        if (!draft || busyRef.current || !body.trim()) return;
        busyRef.current = true;
        setBusy(true);
        setError("");
        const editable = editor.isEditable;
        Reflect.set(editor.storage, "commentSourcePending", true);
        editor.setEditable(false, false);
        try {
            const selection = draft.bookmark.resolve(editor.state.doc);
            if (!draft.id && selection.empty) throw new Error("The selected text was removed. Select text again.");
            if (!draft.saved) {
                let planned: Transaction | undefined;
                const prepareSource = (id: string, href: string): string => {
                    if (editor.isDestroyed) throw new Error("The editor was closed before the comment could be saved.");
                    planned = editor.state.tr;
                    if (!draft.id) {
                        const current = draft.bookmark.resolve(editor.state.doc);
                        planned.addMark(
                            current.from,
                            current.to,
                            editor.schema.marks.link!.create({ href: `${href}#${encodeURIComponent(id)}` }),
                        );
                        planned.addMark(current.from, current.to, editor.schema.marks.highlight!.create());
                    }
                    const serializer = editor.storage.markdown.serializer;
                    if (!serializer) throw new Error("The Markdown editor is not ready.");
                    return serializer.serialize(planned.doc);
                };
                const result = await saveNoteComment(
                    note,
                    draft.quote,
                    body,
                    draft.id,
                    anchors.map((entry) => entry.id),
                    prepareSource,
                    draft.operationId,
                );
                if (editor.isDestroyed) return;
                draft.href = result.href ?? getCommentCompanion(note).href;
                setCompanion(result.note);
                dispatch.syncNoteFromRepository(result.note);
                if (result.source && planned) {
                    editor.view.dispatch(planned.setMeta("preventUpdate", true));
                    onSourcePersisted(result.source);
                    draft.id = result.id;
                } else if (!draft.id) {
                    prepareSource(result.id, result.href ?? getCommentCompanion(note).href);
                    if (planned) editor.view.dispatch(planned.setMeta("preventUpdate", true));
                    draft.id = result.id;
                }
                if (!result.source) {
                    draft.saved = true;
                    setSourceSavePending(true);
                } else draft.saved = false;
            }
            if (isElectron()) await onSaveSource(getEditorMarkdown(editor), draft.href);
            setActiveId(draft.id);
            setBody("");
            setComposing(false);
            setDraftQuote("");
            setSourceSavePending(false);
            draftRef.current = null;
            panelRef.current?.focus();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not save comment.");
        } finally {
            if (!editor.isDestroyed) {
                Reflect.set(editor.storage, "commentSourcePending", Boolean(draftRef.current?.saved));
                editor.setEditable(editable, false);
            }
            busyRef.current = false;
            setBusy(false);
        }
    }

    return (
        <>
            <FormattingToolbar editor={editor} onComment={readonly ? undefined : beginComment} />
            {anchors.length > 0 && (
                <div className="flex justify-end print:hidden">
                    <Button
                        theme="ghost-muted"
                        size="small"
                        disabled={busy || sourceSavePending}
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => {
                            if (open) close();
                            else {
                                setOpen(true);
                                setActiveId(null);
                            }
                        }}
                    >
                        Comments ({new Set(anchors.map((entry) => entry.id)).size})
                    </Button>
                </div>
            )}
            {open && (
                <aside
                    ref={panelRef}
                    id={panelId}
                    tabIndex={-1}
                    aria-label="Sentence comments"
                    aria-busy={busy || loading}
                    className="absolute right-2 z-30 max-h-[70vh] w-80 max-w-[calc(100%-1rem)] overflow-auto rounded-card-radius border border-border bg-card-background p-4 text-sm text-foreground shadow-medium print:hidden"
                >
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <strong>{composing && !activeId ? "New comment" : "Comments"}</strong>
                        <Button
                            theme="ghost-muted"
                            size="small"
                            className="min-h-11 min-w-11"
                            aria-label="Close comments"
                            disabled={busy || sourceSavePending}
                            onClick={close}
                        >
                            Close
                        </Button>
                    </div>
                    {loading && <output>Loading comments…</output>}
                    {error && (
                        <p role="alert" className="mb-3 text-danger">
                            {error}
                        </p>
                    )}
                    {loadFailed && (
                        <Button
                            theme="ghost-muted"
                            onClick={() => {
                                setLoading(true);
                                setLoadFailed(false);
                                setError("");
                                setLoadRevision((value) => value + 1);
                            }}
                        >
                            Retry loading comments
                        </Button>
                    )}
                    {sourceSavePending && !busy && (
                        <output className="mb-3 block text-muted-foreground">
                            Your comment is saved in the comments note. Retry to save its text link.
                        </output>
                    )}
                    {(draftQuote || anchor || thread) && (
                        <blockquote className="mb-3 border-l-2 border-primary pl-3 text-muted-foreground">
                            {draftQuote || anchor?.text || thread?.quote}
                        </blockquote>
                    )}
                    {!activeId && !composing && (
                        <ul className="flex flex-col gap-2">
                            {anchors
                                .filter((entry, index) => anchors.findIndex((other) => other.id === entry.id) === index)
                                .map((entry) => (
                                    <li key={entry.id}>
                                        <button
                                            type="button"
                                            className="min-h-11 w-full rounded-button-radius p-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                            onClick={() => {
                                                setActiveId(entry.id);
                                                editor
                                                    .chain()
                                                    .focus()
                                                    .setTextSelection(entry.from)
                                                    .scrollIntoView()
                                                    .run();
                                            }}
                                        >
                                            {entry.text}{" "}
                                            <span className="text-muted-foreground">
                                                ({threads.find((item) => item.id === entry.id)?.comments.length ?? 0})
                                            </span>
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    )}
                    {activeId && (
                        <ol aria-label="Comments on this text" className="flex flex-col gap-3">
                            {thread?.comments.map((comment, index) => (
                                <li key={index} className="whitespace-pre-wrap break-words border-b border-border pb-3">
                                    {comment}
                                </li>
                            ))}
                        </ol>
                    )}
                    {activeId && !loading && !thread?.comments.length && (
                        <p className="mb-3 text-muted-foreground">No comments yet.</p>
                    )}
                    {composing ? (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void save();
                            }}
                            className="mt-3 flex flex-col gap-3"
                        >
                            <label htmlFor={inputId}>Comment</label>
                            <textarea
                                ref={inputRef}
                                id={inputId}
                                rows={3}
                                required
                                value={body}
                                disabled={busy}
                                readOnly={sourceSavePending}
                                onChange={(event) => setBody(event.target.value)}
                                className="w-full resize-y rounded-input-radius border border-border bg-background p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="flex gap-2">
                                <Button type="submit" disabled={busy || loading || !body.trim()}>
                                    {busy ? "Saving…" : "Save comment"}
                                </Button>
                                <Button
                                    type="button"
                                    theme="ghost-muted"
                                    disabled={busy || sourceSavePending}
                                    onClick={close}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    ) : (
                        activeId &&
                        !readonly && (
                            <Button
                                theme="ghost-primary"
                                className="mt-3"
                                onClick={() => {
                                    draftRef.current = {
                                        operationId: uuid(),
                                        id: activeId,
                                        quote: anchor?.text ?? thread?.quote ?? "",
                                        bookmark: editor.state.selection.getBookmark(),
                                    };
                                    setDraftQuote(anchor?.text ?? thread?.quote ?? "");
                                    setSourceSavePending(false);
                                    setComposing(true);
                                    setError("");
                                }}
                            >
                                Reply
                            </Button>
                        )
                    )}
                    {savedCompanion && (
                        <Button
                            theme="ghost-muted"
                            size="small"
                            className="mt-3 min-h-11"
                            disabled={busy}
                            onClick={() => navigate(`/note/${savedCompanion.id}`)}
                        >
                            Open comments note
                        </Button>
                    )}
                </aside>
            )}
        </>
    );
}
