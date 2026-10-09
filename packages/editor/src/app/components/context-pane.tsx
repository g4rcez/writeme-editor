import { Modal } from "@g4rcez/components";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Note } from "@/store/note";
import { Dates } from "@/lib/dates";
import { findIncomingNoteLinks, resolveNoteLinks } from "@/lib/note-links";

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
    const openedInNarrowViewport = useRef(isNarrow);

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

    useEffect(() => {
        if (isNarrow) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
                event.preventDefault();
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isNarrow, onClose]);

    const linkedNotes = useMemo(() => resolveNoteLinks(note, notes), [note, notes]);
    const incomingNotes = useMemo(() => findIncomingNoteLinks(note, notes), [note, notes]);
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
