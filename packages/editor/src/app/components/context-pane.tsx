import { Modal } from "@g4rcez/components";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Note } from "@/store/note";
import { EscapeLevel, useEscapeLayer } from "@/app/hooks/use-escape-layer";
import { Dates } from "@/lib/dates";
import { markdownLineToPlainText } from "@/lib/markdown-text";
import {
    applyConnectionRepair,
    createConnectionTarget,
    refreshConnectionNotes,
    undoConnectionRepair,
    type ConnectionRepair,
} from "@/lib/note-connection-actions";
import { formatNoteMention } from "@/lib/note-link-repair";
import {
    findIncomingNoteLinks,
    findUnlinkedNoteMentions,
    findUnresolvedNoteLinks,
    resolveNoteLinks,
} from "@/lib/note-links";
import { parseObsidianLink, formatObsidianLink } from "@/lib/obsidian-links";

type OutlineHeading = {
    id: string;
    level: number;
    text: string;
    element: HTMLHeadingElement;
};

type ContextPaneProps = {
    note: Note;
    notes: Note[];
    onClose: () => void;
};

function readOutline(): OutlineHeading[] {
    const container = document.getElementById("main-scroll-container") ?? document.body;
    return Array.from(
        container.querySelectorAll<HTMLHeadingElement>(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3"),
    )
        .map((element, index) => ({
            element,
            id: element.id || element.dataset.id || `context-heading-${index}`,
            level: Number(element.tagName.slice(1)),
            text: element.textContent?.trim() || "Untitled section",
        }))
        .filter((heading) => heading.text.length > 0);
}

function scrollToHeading(element: HTMLElement): void {
    const container = document.getElementById("main-scroll-container");
    if (!container) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    const targetScrollTop = container.scrollTop + targetRect.top - containerRect.top - 48;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior });
}

function ContextSection({
    title,
    count,
    children,
    open = false,
}: {
    title: string;
    count?: number;
    children: ReactNode;
    open?: boolean;
}) {
    return (
        <details className="writeme-context-section" open={open}>
            <summary>
                <span className="flex min-w-0 items-center gap-2">
                    <span>{title}</span>
                    {count !== undefined ? (
                        <span className="font-mono text-[10px] text-muted-foreground/60">{count}</span>
                    ) : null}
                </span>
            </summary>
            {children}
        </details>
    );
}

export function ContextPane({ note, notes, onClose }: ContextPaneProps) {
    const [headings, setHeadings] = useState<OutlineHeading[]>([]);
    const [isNarrow, setIsNarrow] = useState(() => window.matchMedia?.("(max-width: 959px)").matches ?? false);
    const [repairError, setRepairError] = useState<string | null>(null);
    const [preview, setPreview] = useState<ConnectionRepair | null>(null);
    const [busy, setBusy] = useState(false);
    const actionPending = useRef(false);
    const previewElement = useRef<HTMLElement>(null);
    const previewTrigger = useRef<HTMLButtonElement | null>(null);
    const feedbackElement = useRef<HTMLOutputElement>(null);
    const connectionControls = useRef<HTMLFieldSetElement>(null);
    const searchElement = useRef<HTMLInputElement>(null);
    const choosingTrigger = useRef<HTMLButtonElement | null>(null);
    const [choosingReference, setChoosingReference] = useState<number | null>(null);
    const [targetQuery, setTargetQuery] = useState("");
    const [undo, setUndo] = useState<{ saved: Note; originalContent: string } | null>(null);
    const openedInNarrowViewport = useRef(isNarrow);

    useEffect(() => {
        if (preview) previewElement.current?.focus();
    }, [preview]);
    useEffect(() => {
        if (!busy && repairError) feedbackElement.current?.focus();
    }, [busy, repairError]);
    useEffect(() => {
        if (choosingReference !== null) searchElement.current?.focus();
    }, [choosingReference]);
    useEffect(() => {
        const escape = (event: KeyboardEvent): void => {
            if (
                event.key !== "Escape" ||
                (!preview && choosingReference === null) ||
                !connectionControls.current?.contains(document.activeElement)
            )
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (preview) {
                setPreview(null);
                previewTrigger.current?.focus();
            } else {
                setChoosingReference(null);
                choosingTrigger.current?.focus();
            }
        };
        window.addEventListener("keydown", escape, true);
        return () => window.removeEventListener("keydown", escape, true);
    }, [preview, choosingReference]);
    const cancelPreview = (): void => {
        setPreview(null);
        previewTrigger.current?.focus();
    };

    useEffect(() => {
        const media = window.matchMedia?.("(max-width: 959px)");
        if (!media) return;
        const update = () => setIsNarrow(media.matches);
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (openedInNarrowViewport.current) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        return () => {
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);

    useEffect(() => {
        const container = document.getElementById("main-scroll-container");
        if (!container) return;

        const update = () => setHeadings(readOutline());
        update();
        const observer = new MutationObserver(update);
        observer.observe(container, { subtree: true, childList: true, characterData: true });
        return () => observer.disconnect();
    }, [note.id]);

    useEscapeLayer(EscapeLevel.panel, !isNarrow, onClose);

    const linkedNotes = useMemo(() => resolveNoteLinks(note, notes), [note, notes]);
    const incomingNotes = useMemo(() => findIncomingNoteLinks(note, notes), [note, notes]);
    const unresolvedLinks = useMemo(() => findUnresolvedNoteLinks(note, notes), [note, notes]);
    const unlinkedMentions = useMemo(() => findUnlinkedNoteMentions(note, notes), [note, notes]);
    const runAction = async (action: () => Promise<void>): Promise<void> => {
        if (actionPending.current) return;
        actionPending.current = true;
        setBusy(true);
        setRepairError(null);
        try {
            await action();
        } catch (error: unknown) {
            setRepairError(error instanceof Error ? error.message : "Could not update the connection. Try again.");
        } finally {
            actionPending.current = false;
            setBusy(false);
        }
    };
    const applyRepair = async (repair: ConnectionRepair): Promise<void> => {
        const saved = await applyConnectionRepair(repair);
        setUndo(saved ? { saved, originalContent: repair.source.content } : null);
        setPreview(null);
        setRepairError(saved ? "Link added." : "Link added in the editor. Save or undo it as you would any edit.");
    };
    const repairReference = async (
        reference: (typeof unresolvedLinks)[number]["reference"],
        target: Note,
    ): Promise<void> => {
        const parsed = parseObsidianLink(reference.raw);
        const replacement =
            reference.kind === "id"
                ? formatNoteMention(target.id, reference.label)
                : formatObsidianLink({
                      target: target.id,
                      embed: parsed?.embed,
                      subpath: parsed?.subpath,
                      alias: parsed?.alias ?? parsed?.display ?? reference.target,
                  });
        await applyRepair({ source: note, target, from: reference.from, to: reference.to, replacement });
    };
    const repairSections = (
        <fieldset ref={connectionControls} disabled={busy} className="min-w-0 border-0 p-0 [&_button]:min-h-11">
            <ContextSection title="Unresolved references" count={unresolvedLinks.length}>
                {unresolvedLinks.length === 0 ? (
                    <p className="writeme-context-empty">Missing note references will appear here.</p>
                ) : (
                    <ul className="writeme-context-list">
                        {unresolvedLinks.map(({ reference, candidates }) => (
                            <li key={reference.from} className="px-2 py-2">
                                <p className="break-words text-sm font-medium text-foreground">{reference.raw}</p>
                                <p className="text-xs text-muted-foreground">
                                    {candidates.length > 1 ? "More than one matching note." : "No matching note yet."}
                                </p>
                                {candidates.length === 0 ? (
                                    <button
                                        type="button"
                                        className="writeme-context-list-button"
                                        onClick={() =>
                                            void runAction(async () => {
                                                const target = await createConnectionTarget(
                                                    reference.kind === "wiki" ? reference.target : reference.label,
                                                );
                                                if (reference.kind === "id") await repairReference(reference, target);
                                                else setRepairError("Note ready. References have been refreshed.");
                                            })
                                        }
                                    >
                                        Create note
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="writeme-context-list-button"
                                    aria-expanded={choosingReference === reference.from}
                                    onClick={(event) => {
                                        choosingTrigger.current = event.currentTarget;
                                        setChoosingReference(
                                            choosingReference === reference.from ? null : reference.from,
                                        );
                                        setTargetQuery("");
                                    }}
                                >
                                    Choose existing note
                                </button>
                                {choosingReference === reference.from ? (
                                    <div className="mt-2">
                                        <label className="block text-xs text-muted-foreground">
                                            Find a note
                                            <input
                                                ref={searchElement}
                                                value={targetQuery}
                                                onChange={(event) => setTargetQuery(event.target.value)}
                                                className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                            />
                                        </label>
                                        <ul>
                                            {(candidates.length > 0 && !targetQuery
                                                ? candidates
                                                : notes.filter(
                                                      (candidate) =>
                                                          candidate.id !== note.id &&
                                                          candidate.title
                                                              .toLocaleLowerCase()
                                                              .includes(targetQuery.toLocaleLowerCase()),
                                                  )
                                            )
                                                .slice(0, 30)
                                                .map((candidate) => (
                                                    <li key={candidate.id}>
                                                        <button
                                                            type="button"
                                                            data-note-id={candidate.id}
                                                            className="writeme-context-list-button text-left"
                                                            onClick={() =>
                                                                void runAction(() =>
                                                                    repairReference(reference, candidate),
                                                                )
                                                            }
                                                        >
                                                            <span className="block">
                                                                {candidate.title || "Untitled"}
                                                            </span>
                                                            <span className="block break-all text-xs text-muted-foreground">
                                                                {candidate.filePath ||
                                                                    markdownLineToPlainText(
                                                                        candidate.content.slice(0, 100),
                                                                    ) ||
                                                                    "Empty note"}
                                                            </span>
                                                        </button>
                                                    </li>
                                                ))}
                                        </ul>
                                        {notes.filter(
                                            (candidate) =>
                                                candidate.id !== note.id &&
                                                candidate.title
                                                    .toLocaleLowerCase()
                                                    .includes(targetQuery.toLocaleLowerCase()),
                                        ).length === 0 ? (
                                            <p className="writeme-context-empty">No notes match. Try another name.</p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </ContextSection>
            <ContextSection title="Unlinked mentions" count={unlinkedMentions.length}>
                {unlinkedMentions.length === 0 ? (
                    <p className="writeme-context-empty">No unlinked title or alias mentions in other notes.</p>
                ) : (
                    <ul className="writeme-context-list">
                        {unlinkedMentions.map((mention) => (
                            <li key={mention.source.id + ":" + mention.from} className="px-2 py-2">
                                <Link
                                    className="block text-sm font-medium text-foreground hover:underline"
                                    to={"/note/" + mention.source.id}
                                >
                                    {mention.source.title || "Untitled"}
                                </Link>
                                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                                    {mention.excerpt}
                                </p>
                                <button
                                    type="button"
                                    className="writeme-context-list-button"
                                    onClick={(event) => {
                                        previewTrigger.current = event.currentTarget;
                                        setPreview({
                                            source: mention.source,
                                            target: note,
                                            from: mention.from,
                                            to: mention.to,
                                            replacement: formatNoteMention(note.id, mention.text),
                                        });
                                        setRepairError(null);
                                    }}
                                >
                                    Preview link
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {preview ? (
                    <section
                        ref={previewElement}
                        tabIndex={-1}
                        aria-label="Link preview"
                        className="m-2 rounded-md border border-border p-2 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <p className="text-sm text-foreground">
                            {preview.source.title} → {preview.target.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Only the highlighted occurrence will become a link:
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-foreground">
                            {preview.source.content.slice(Math.max(0, preview.from - 50), preview.from)}
                            <mark className="bg-primary/10 text-primary underline">
                                {preview.source.content.slice(preview.from, preview.to)}
                            </mark>
                            {preview.source.content.slice(preview.to, preview.to + 50)}
                        </p>
                        <button
                            type="button"
                            className="writeme-context-list-button"
                            onClick={() => void runAction(() => applyRepair(preview))}
                        >
                            Link this mention
                        </button>
                        <button type="button" className="writeme-context-list-button" onClick={cancelPreview}>
                            Cancel preview
                        </button>
                    </section>
                ) : null}
            </ContextSection>
            {busy ? (
                <output aria-live="polite" className="writeme-context-empty block">
                    Updating connection…
                </output>
            ) : null}
            {repairError ? (
                <div>
                    <output
                        ref={feedbackElement}
                        tabIndex={-1}
                        aria-live="polite"
                        className="writeme-context-empty block"
                    >
                        {repairError}
                    </output>
                    <button
                        type="button"
                        className="writeme-context-list-button"
                        onClick={() =>
                            void runAction(async () => {
                                await refreshConnectionNotes();
                                setPreview(null);
                                setRepairError("Suggestions refreshed. Preview an occurrence to try again.");
                            })
                        }
                    >
                        Refresh suggestions
                    </button>
                </div>
            ) : null}
            {undo ? (
                <button
                    type="button"
                    className="writeme-context-list-button"
                    onClick={() =>
                        void runAction(async () => {
                            await undoConnectionRepair(undo.saved, undo.originalContent);
                            setUndo(null);
                            setRepairError("Link undone.");
                        })
                    }
                >
                    Undo link
                </button>
            ) : null}
        </fieldset>
    );
    const tags = note.tags.filter((tag, index, allTags) => allTags.indexOf(tag) === index);
    const noteType = note.noteType === "note" ? "Markdown" : note.noteType;

    const sections = (
        <div className="writeme-context-pane-content">
            <ContextSection title="On this page" count={headings.length} open={headings.length > 0}>
                {headings.length > 0 ? (
                    <ul className="writeme-context-list">
                        {headings.map((heading) => (
                            <li key={`${heading.id}-${heading.text}`}>
                                <button
                                    type="button"
                                    className="writeme-context-list-button"
                                    style={{ paddingLeft: `${0.625 + Math.max(0, heading.level - 1) * 0.75}rem` }}
                                    onClick={() => scrollToHeading(heading.element)}
                                >
                                    <span className="line-clamp-2">{heading.text}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="writeme-context-empty">Headings will appear here as you structure the note.</p>
                )}
            </ContextSection>
            {repairSections}

            <ContextSection title="Linked notes" count={linkedNotes.length}>
                {linkedNotes.length > 0 ? (
                    <ul className="writeme-context-list">
                        {linkedNotes.map(({ note: linkedNote }) => (
                            <li key={linkedNote.id}>
                                <Link
                                    className="writeme-context-list-button block truncate"
                                    to={`/note/${linkedNote.id}`}
                                >
                                    {linkedNote.title || "Untitled"}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="writeme-context-empty">Links to other notes will show up here.</p>
                )}
            </ContextSection>

            <ContextSection title="Incoming links" count={incomingNotes.length}>
                {incomingNotes.length > 0 ? (
                    <ul className="writeme-context-list">
                        {incomingNotes.map(({ note: source, excerpt }) => (
                            <li key={source.id} className="px-2 py-1.5">
                                <Link
                                    className="block truncate text-sm font-medium text-foreground hover:underline"
                                    to={`/note/${source.id}`}
                                >
                                    {source.title || "Untitled"}
                                </Link>
                                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{excerpt}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="writeme-context-empty">Notes that link here will appear here.</p>
                )}
            </ContextSection>

            <ContextSection title="Properties">
                <dl className="mt-2">
                    <div className="writeme-context-property">
                        <dt>Type</dt>
                        <dd>{noteType}</dd>
                    </div>
                    <div className="writeme-context-property">
                        <dt>Updated</dt>
                        <dd>{Dates.yearMonthDay(note.updatedAt)}</dd>
                    </div>
                    <div className="writeme-context-property">
                        <dt>Created</dt>
                        <dd>{Dates.yearMonthDay(note.createdAt)}</dd>
                    </div>
                    <div className="writeme-context-property">
                        <dt>Location</dt>
                        <dd title={note.filePath ?? undefined}>{note.filePath ? "Workspace file" : "Local note"}</dd>
                    </div>
                </dl>
            </ContextSection>

            <ContextSection title="Tags" count={tags.length}>
                {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 px-2.5">
                        {tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                #{tag}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="writeme-context-empty">Add tags to make this note easier to find.</p>
                )}
            </ContextSection>
        </div>
    );

    if (isNarrow) {
        return (
            <Modal
                open
                onChange={(open) => {
                    if (!open) onClose();
                }}
                type="drawer"
                position="right"
                forceType
                title="Context"
                ariaDescription={`Note context for ${note.title || "Untitled"}`}
                className="writeme-context-modal"
                bodyClassName="writeme-context-modal-body"
            >
                <p className="writeme-context-modal-note">{note.title || "Untitled"}</p>
                {sections}
            </Modal>
        );
    }

    return (
        <aside className="writeme-context-pane" aria-labelledby="writeme-context-pane-title">
            <header className="writeme-context-pane-header">
                <div className="min-w-0">
                    <h2
                        id="writeme-context-pane-title"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                        Context
                    </h2>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">{note.title || "Untitled"}</p>
                </div>
                <button
                    type="button"
                    className="writeme-header-action"
                    aria-label="Close note context"
                    title="Close note context"
                    onClick={onClose}
                >
                    <XIcon size={16} aria-hidden="true" />
                </button>
            </header>
            {sections}
        </aside>
    );
}
