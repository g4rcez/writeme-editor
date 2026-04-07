import { Modal, Tooltip } from "@g4rcez/components";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { useKeyboardNavigation } from "@/app/hooks/use-keyboard-navigation";
import { type NoteWithTags } from "@/app/hooks/use-note-list";
import { useSidebarNotes } from "@/app/hooks/use-sidebar-notes";
import { Dates } from "@/lib/dates";
import { globalDispatch } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SortAscendingIcon } from "@phosphor-icons/react";

export type NoteItemProps = {
  note: NoteWithTags;
  isActive: boolean;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  extra?: React.ReactNode;
};

export const NoteItem = ({
  note,
  isActive,
  onClick,
  onToggleFavorite,
  onDelete,
  extra,
}: NoteItemProps) => {
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
      onClick={onClick}
      className={`group relative cursor-pointer px-3 py-2.5 transition-all hover:bg-muted/20 ${
        isActive
          ? "bg-muted/40 border-l-2 border-primary"
          : "border-l-2 border-transparent"
      }`}
    >
      <div className="flex gap-2 justify-between items-start mb-1">
        <h3
          className={`font-medium text-sm line-clamp-1 flex-1 ${
            isActive ? "text-primary" : "text-foreground"
          }`}
        >
          {note.title || "Untitled"}
        </h3>
        {extra}
        <button
          onClick={onToggleFavorite}
          className={`shrink-0 p-0.5 rounded hover:bg-background/80 transition-opacity ${
            note.favorite
              ? "text-yellow-500 opacity-100"
              : "text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
        >
          <StarIcon
            className={`size-3 ${note.favorite ? "fill-current" : ""}`}
          />
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="shrink-0 p-0.5 rounded hover:bg-background/80 transition-opacity text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500"
          >
            <TrashIcon className="size-3" />
          </button>
        )}
      </div>
      <p className="mb-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {note.description ||
          note.content.substring(0, 150).replace(/[#*`]/g, "") ||
          "No content"}
      </p>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="px-1 rounded bg-primary/5 text-primary/70 text-[10px]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-between items-center text-[10px] text-muted-foreground/60">
        <span>{Dates.yearMonthDay(note.createdAt)}</span>
        {wasEdited && (
          <span className="text-muted-foreground/40">
            edited {Dates.yearMonthDay(note.updatedAt)}
          </span>
        )}
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
    const confirmed = await Modal.confirm({
      title: "Delete note",
      description: "Are you sure you want to delete this note?",
      confirm: { text: "Delete", theme: "danger" },
    });
    if (confirmed) {
      await globalDispatch.deleteNote(note.id);
    }
  };

  return (
    <ul className="flex overflow-y-auto flex-col h-full divide-y max-h- divide-border/20 scrollbar-hide">
      <li
        onClick={props.onCreateNewNote}
        className="flex sticky top-0 gap-1 items-center p-2 text-sm transition-all cursor-pointer bg-card-background z-floating text-muted-foreground hover:bg-muted/30 hover:text-foreground"
      >
        <PlusIcon className="size-4" />
        <span>New note</span>
      </li>
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
  );
};

type SortBy = "updatedAt" | "createdAt" | "alphabetical";

export const NoteListSidebar = () => {
  const [state, layoutDispatch] = useLayoutStore();
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const { notes, loading } = useSidebarNotes({ sortBy });
  const params = useParams();
  const activeNoteId = params.noteId;
  const containerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(notes, activeNoteId, containerRef as any);

  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) =>
    layoutDispatch.setSearch(e.target.value);

  const createNewNote = () =>
    globalDispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

  const getHeaderTitle = () => {
    switch (state.activeActivity) {
      case "favorites":
        return "Favorites";
      case "tags":
        return state.activeView.type === "tag"
          ? `Tag: #${state.activeView.id}`
          : "Tags";
      default:
        return "Notes";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 items-center">
          <div className="w-4 h-4 rounded-full border-2 animate-spin border-primary border-t-transparent" />
          <span>Loading notes...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background">
      <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          {getHeaderTitle()}
        </span>
        <div className="flex gap-0.5 items-center">
          <Tooltip
            placement="bottom"
            title={
              <button
                onClick={() => setSortBy("updatedAt")}
                className={`p-1 rounded transition-colors ${sortBy === "updatedAt" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <ClockCounterClockwiseIcon className="size-3.5" />
              </button>
            }
          >
            Last edited
          </Tooltip>
          <Tooltip
            placement="bottom"
            title={
              <button
                onClick={() => setSortBy("createdAt")}
                className={`p-1 rounded transition-colors ${sortBy === "createdAt" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <CalendarIcon className="size-3.5" />
              </button>
            }
          >
            Created date
          </Tooltip>
          <Tooltip
            placement="bottom"
            title={
              <button
                onClick={() => setSortBy("alphabetical")}
                className={`p-1 rounded transition-colors font-bold leading-none ${sortBy === "alphabetical" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <SortAscendingIcon />
              </button>
            }
          >
            Alphabetical
          </Tooltip>
        </div>
      </div>
      <div className="p-3 border-b border-border/20">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            onChange={onSearch}
            placeholder="Search..."
            value={state.searchQuery}
            className="py-1.5 pr-3 pl-9 w-full text-sm rounded-md border border-transparent transition-all outline-none bg-muted/40 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background"
          />
        </div>
      </div>
      {notes.length === 0 ? (
        <div className="flex flex-col flex-1 gap-4 justify-center items-center py-4 h-full text-sm text-muted-foreground">
          <span>No notes found</span>
          <button
            onClick={createNewNote}
            className="flex gap-2 items-center py-1.5 px-3 rounded-md border transition-all border-border/40 hover:bg-muted/50 hover:text-foreground"
          >
            <PlusIcon className="size-4" />
            <span>Create first note</span>
          </button>
        </div>
      ) : (
        <NoteListItems
          notes={notes}
          activeNoteId={activeNoteId}
          onCreateNewNote={createNewNote}
        />
      )}
    </div>
  );
};
