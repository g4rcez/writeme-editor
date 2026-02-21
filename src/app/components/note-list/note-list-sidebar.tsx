import { Clock, Plus, Search, Star } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dates } from "@/lib/dates";
import { repositories } from "@/store/repositories";
import { useLayoutContext } from "@/app/contexts/layout-context";
import { useKeyboardNavigation } from "@/app/hooks/use-keyboard-navigation";
import { NoteWithTags } from "@/app/hooks/use-note-list";
import { useSidebarNotes } from "@/app/hooks/use-sidebar-notes";
import { Note } from "@/store/note";
import { globalDispatch } from "@/store/global.store";

type NoteItemProps = {
  note: NoteWithTags;
  isActive: boolean;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
};

const NoteItem = ({
  note,
  isActive,
  onClick,
  onToggleFavorite,
}: NoteItemProps) => {
  const itemRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <li
      ref={itemRef}
      onClick={onClick}
      className={`group relative cursor-pointer p-4 transition-all hover:bg-muted/30 ${
        isActive
          ? "bg-muted/50 border-l-2 border-primary"
          : "border-l-2 border-transparent"
      }`}
    >
      <div className="flex gap-2 justify-between items-start mb-1">
        <h3
          className={`font-medium text-sm line-clamp-1 ${
            isActive ? "text-primary" : "text-foreground"
          }`}
        >
          {note.title || "Untitled"}
        </h3>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onToggleFavorite}
            className={`p-1 rounded-md hover:bg-background/80 ${note.favorite ? "text-yellow-500 opacity-100" : "text-muted-foreground"}`}
          >
            <Star className={`size-3 ${note.favorite ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>
      <p className="mb-2 h-8 text-xs text-muted-foreground line-clamp-2">
        {note.description ||
          note.content.substring(0, 150).replace(/[#*`]/g, "") ||
          "No content"}
      </p>
      <div className="flex gap-2 items-center text-[10px] text-muted-foreground/60">
        <span className="flex gap-1 items-center">
          <Clock className="size-3" />
          {Dates.yearMonthDay(note.createdAt)}
        </span>
        {note.tags.length > 0 && (
          <div className="flex gap-1">
            {note.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1 rounded bg-primary/5 text-primary/70 truncate max-w-[60px]"
              >
                #{tag}
              </span>
            ))}
            {note.tags.length > 2 && <span>+{note.tags.length - 2}</span>}
          </div>
        )}
      </div>
    </li>
  );
};

export const NoteListSidebar = () => {
  const { state, dispatch } = useLayoutContext();
  const { notes, loading } = useSidebarNotes();
  const navigate = useNavigate();
  const params = useParams();
  const activeNoteId = params.noteId;
  const containerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(notes, activeNoteId, containerRef);

  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) =>
    dispatch({ type: "SET_SEARCH", query: e.target.value });

  const createNewNote = () =>
    globalDispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

  const toggleFavorite = async (e: React.MouseEvent, note: NoteWithTags) => {
    e.stopPropagation();
    const updatedNote = Note.parse(note);
    updatedNote.favorite = !note.favorite;
    await repositories.notes.update(note.id, updatedNote);
    globalDispatch.syncNoteState(updatedNote);
  };

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
    <div ref={containerRef} className="flex flex-col h-full bg-background/50">
      <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          {getHeaderTitle()}
        </span>
      </div>
      <div className="p-3 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={state.searchQuery}
            onChange={onSearch}
            className="py-1.5 pr-3 pl-9 w-full text-sm rounded-md border border-transparent transition-all outline-none bg-muted/40 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background"
          />
        </div>
      </div>
      {notes.length === 0 ? (
        <div className="flex flex-col flex-1 h-full gap-4 justify-center items-center h-full text-sm text-muted-foreground">
          <span>No notes found</span>
          <button
            onClick={createNewNote}
            className="flex gap-2 items-center py-1.5 px-3 rounded-md border transition-all border-border/40 hover:bg-muted/50 hover:text-foreground"
          >
            <Plus className="size-4" />
            <span>Create first note</span>
          </button>
        </div>
      ) : (
        <ul className="flex overflow-y-auto flex-col h-full divide-y max-h- divide-border/20 scrollbar-hide">
          <li
            onClick={createNewNote}
            className="flex sticky top-0 gap-1 items-center p-2 text-sm transition-all cursor-pointer bg-card-background z-floating text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          >
            <Plus className="size-4" />
            <span>New note</span>
          </li>
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onClick={() => navigate(`/note/${note.id}`)}
              onToggleFavorite={(e) => toggleFavorite(e, note)}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
