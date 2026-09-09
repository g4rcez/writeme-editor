import { Input, Tooltip } from "@g4rcez/components";
import { SortAscendingIcon } from "@phosphor-icons/react";
import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { NoteWithTags } from "@/app/hooks/use-note-list";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { useKeyboardNavigation } from "@/app/hooks/use-keyboard-navigation";
import { useSidebarNotes } from "@/app/hooks/use-sidebar-notes";
import { notificationRef } from "@/app/notification-ref";
import { Dates } from "@/lib/dates";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";

export type NoteItemProps = {
    note: NoteWithTags;
    isActive: boolean;
    onClick: () => void;
    onToggleFavorite: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    extra?: React.ReactNode;
};

export const NoteItem = ({ note, isActive, onClick, onToggleFavorite, onDelete, extra }: NoteItemProps) => {
    const itemRef = useRef<HTMLLIElement>(null);
    useEffect(() => {
        if (isActive && itemRef.current) {
            itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [isActive]);

    const createdTime = note.createdAt.getTime();
    const updatedTime = note.updatedAt.getTime();
    const wasEdited = Math.abs(updatedTime - createdTime) > 60_000;

    return (
        <li
            ref={itemRef}
            className={`group relative min-h-16 shrink-0 border-l-2 transition-[background-color,border-color] hover:bg-muted/30 ${
                isActive ? "border-primary bg-primary/10" : "border-transparent"
            }`}
        >
            <div className="flex items-start gap-2 px-3 py-3">
                <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={onClick}
                    className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                    <h3
                        className={`mb-1 line-clamp-1 text-sm font-medium ${
                            isActive ? "text-primary" : "text-foreground"
                        }`}
                    >
                        {note.title || "Untitled"}
                    </h3>
                    <p className="mb-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {note.description || note.content.substring(0, 150).replace(/[#*`]/g, "") || "No content"}
                    </p>
                    {note.tags.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                            {note.tags.map((tag) => (
                                <span key={tag} className="rounded bg-primary/5 px-1 text-[10px] text-primary/70">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/60">
                        <span>{Dates.yearMonthDay(note.createdAt)}</span>
                        {wasEdited ? (
                            <span className="text-muted-foreground/40">
                                edited {Dates.yearMonthDay(note.updatedAt)}
                            </span>
                        ) : null}
                    </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    {extra}
                    <button
                        type="button"
                        aria-label={
                            note.favorite ? `Unstar ${note.title || "Untitled"}` : `Star ${note.title || "Untitled"}`
                        }
                        onClick={onToggleFavorite}
                        className={`flex size-7 items-center justify-center rounded-md transition-[background-color,opacity] hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            note.favorite
                                ? "text-warn opacity-100"
                                : "text-muted-foreground opacity-0 group-hover:opacity-100"
                        }`}
                    >
                        <StarIcon aria-hidden="true" className={`size-3 ${note.favorite ? "fill-current" : ""}`} />
                    </button>
                    {onDelete ? (
                        <button
                            type="button"
                            aria-label={`Delete ${note.title || "Untitled"}`}
                            onClick={onDelete}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[background-color,color,opacity] hover:bg-background/80 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <TrashIcon aria-hidden="true" className="size-3" />
                        </button>
                    ) : null}
                </div>
            </div>
        </li>
    );
};

const NoteListItems = (props: {
    notes: NoteWithTags[];
    onCreateNewNote: () => void;
    activeNoteId: string | undefined;
}) => {
    const navigate = useNavigate();
    const toggleFavorite = async (e: React.MouseEvent, note: NoteWithTags) => {
        e.stopPropagation();
        const updatedNote = Note.parse(note);
        updatedNote.favorite = !note.favorite;
        await repositories.notes.update(note.id, updatedNote);
        globalDispatch.syncNoteState(updatedNote);
    };

    const handleDelete = async (e: React.MouseEvent, note: NoteWithTags) => {
        e.stopPropagation();
        await globalDispatch.deleteNote(note.id);
        const notify = notificationRef.current;
        if (notify) {
            const closeRef = { current: () => {} };
            const { close } = notify(
                <div className="flex items-center gap-2">
                    <span>"{note.title}" moved to Trash.</span>
                    <button
                        type="button"
                        className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-70"
                        onClick={() => {
                            closeRef.current();
                            globalDispatch.restoreNote(note.id);
                        }}
                    >
                        Undo
                    </button>
                </div>,
                {
                    theme: "info",
                    closable: true,
                    id: `trash:${note.id}`,
                    timeout: 8000,
                },
            );
            closeRef.current = close;
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/40 bg-card-background px-2 py-2">
                <button
                    type="button"
                    onClick={props.onCreateNewNote}
                    className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <PlusIcon className="size-4" aria-hidden="true" />
                    <span>New note</span>
                </button>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide" aria-label="Notes">
                {props.notes.map((note) => (
                    <NoteItem
                        note={note}
                        key={note.id}
                        isActive={note.id === props.activeNoteId}
                        onClick={() => navigate(`/note/${note.id}`)}
                        onToggleFavorite={(e) => toggleFavorite(e, note)}
                        onDelete={(e) => handleDelete(e, note)}
                    />
                ))}
            </ul>
        </div>
    );
};

type SortBy = "updatedAt" | "createdAt" | "alphabetical";

export const NoteListSidebar = () => {
    const [state, layoutDispatch] = useLayoutStore();
    const [globalState] = useGlobalStore();
    const [sortBy, setSortBy] = useState<SortBy>("createdAt");
    const { notes, loading } = useSidebarNotes({ sortBy });
    const params = useParams();
    const activeNoteId = params.noteId;
    const containerRef = useRef<HTMLDivElement>(null);
    useKeyboardNavigation(notes, activeNoteId, containerRef as any);

    const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => layoutDispatch.setSearch(e.target.value);

    const createNewNote = () => globalDispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

    const getHeaderTitle = () => {
        switch (state.activeActivity) {
            case "favorites":
                return "Favorites";
            case "tags":
                return state.activeView.type === "tag" ? `Tag: #${state.activeView.id}` : "Tags";
            default:
                return "Notes";
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Loading notes…</span>
                </div>
            </div>
        );
    }

    const query = state.searchQuery.trim();
    const hasNotes = globalState.notes.some((note) => {
        if (state.activeActivity === "favorites") return note.favorite;
        if (state.activeActivity === "tags" && state.activeView.type === "tag") {
            return note.tags.includes(state.activeView.id);
        }
        return note.noteType === "note";
    });

    return (
        <div ref={containerRef} className="flex h-full min-h-0 flex-col bg-background">
            <div className="flex items-center justify-between border-b border-border/40 px-1 py-2">
                <span className="text-xs font-medium text-foreground">{getHeaderTitle()}</span>
                <div className="flex gap-1 items-center">
                    <Tooltip
                        placement="bottom"
                        title={
                            <button
                                type="button"
                                aria-label="Sort by created date"
                                aria-pressed={sortBy === "createdAt"}
                                title="Sort by created date"
                                onClick={() => setSortBy("createdAt")}
                                className={`p-1 rounded transition-colors ${sortBy === "createdAt" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <CalendarIcon className="size-3.5" aria-hidden="true" />
                            </button>
                        }
                    >
                        Created date
                    </Tooltip>
                    <Tooltip
                        placement="bottom"
                        title={
                            <button
                                type="button"
                                aria-label="Sort by last edited"
                                aria-pressed={sortBy === "updatedAt"}
                                title="Sort by last edited"
                                onClick={() => setSortBy("updatedAt")}
                                className={`p-1 rounded transition-colors ${sortBy === "updatedAt" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <ClockCounterClockwiseIcon className="size-3.5" aria-hidden="true" />
                            </button>
                        }
                    >
                        Last edited
                    </Tooltip>
                    <Tooltip
                        placement="bottom"
                        title={
                            <button
                                type="button"
                                aria-label="Sort alphabetically"
                                aria-pressed={sortBy === "alphabetical"}
                                title="Sort alphabetically"
                                onClick={() => setSortBy("alphabetical")}
                                className={`p-1 rounded transition-colors font-bold leading-none ${sortBy === "alphabetical" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <SortAscendingIcon aria-hidden="true" />
                            </button>
                        }
                    >
                        Alphabetical
                    </Tooltip>
                </div>
            </div>
            <div className="px-1 py-2">
                <Input
                    optionalText=" "
                    onChange={onSearch}
                    placeholder="Search notes…"
                    value={state.searchQuery}
                    right={<MagnifyingGlassIcon className="size-4 text-muted-foreground" />}
                />
            </div>
            {notes.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center text-sm text-muted-foreground">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                        <MagnifyingGlassIcon size={17} aria-hidden="true" />
                    </span>
                    <div>
                        <p className="font-medium text-foreground">
                            {query || hasNotes ? "No matching notes" : "No notes yet"}
                        </p>
                        <p className="mt-1 text-xs leading-5">
                            {query || hasNotes
                                ? "Try a different search or clear the filter."
                                : "Create a note and your workspace will appear here."}
                        </p>
                    </div>
                    {query || hasNotes ? (
                        <button
                            type="button"
                            onClick={() => layoutDispatch.setSearch("")}
                            className="min-h-9 rounded-md border border-border/50 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            Clear search
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={createNewNote}
                            className="flex min-h-9 items-center gap-2 rounded-md border border-border/50 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <PlusIcon className="size-4" aria-hidden="true" />
                            <span>Create first note</span>
                        </button>
                    )}
                </div>
            ) : (
                <NoteListItems notes={notes} activeNoteId={activeNoteId} onCreateNewNote={createNewNote} />
            )}
        </div>
    );
};
