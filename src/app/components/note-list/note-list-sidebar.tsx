import {
  FileText,
  Search,
  Tag,
  Clock,
  MoreHorizontal,
  Star,
} from "lucide-react";
import { useSidebarNotes } from "../../hooks/use-sidebar-notes";
import { useLayoutContext } from "../../contexts/layout-context";
import { Dates } from "../../../lib/dates";
import { getReadingTime } from "../../../lib/file-utils";
import { useNavigate, useParams } from "react-router-dom";
import { useKeyboardNavigation } from "../../hooks/use-keyboard-navigation";
import { NoteWithTags } from "../../hooks/use-note-list";
import { useEffect, useRef } from "react";
import { repositories } from "../../../store/repositories";

export const NoteListSidebar = () => {
  const { state, dispatch } = useLayoutContext();
  const { notes, loading } = useSidebarNotes();
  const navigate = useNavigate();
  const params = useParams();
  const activeNoteId = params.noteId;

  // Enable keyboard navigation
  useKeyboardNavigation(notes, activeNoteId);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_SEARCH", query: e.target.value });
  };

  const toggleFavorite = async (e: React.MouseEvent, note: NoteWithTags) => {
    e.stopPropagation();
    // Optimistic update would be better, but for now just wait for global store update
    const { tagsList, tagCount, ...noteData } = note;
    await repositories.notes.update(note.id, {
      ...noteData,
      favorite: !note.favorite,
    } as any);
    // Note: The global store listener should pick this up and refresh the list
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
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading notes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border/20 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {getHeaderTitle()}
        </span>
      </div>

      {/* Search Header */}
      <div className="p-3 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={state.searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-muted/40 text-sm pl-9 pr-3 py-1.5 rounded-md border border-transparent focus:border-primary/50 focus:bg-background outline-none transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
            <span>No notes found</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
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
    </div>
  );
};

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
      <div className="flex justify-between items-start gap-2 mb-1">
        <h3
          className={`font-medium text-sm line-clamp-1 ${
            isActive ? "text-primary" : "text-foreground"
          }`}
        >
          {note.title || "Untitled"}
        </h3>
        {/* Hover Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={onToggleFavorite}
            className={`p-1 rounded-md hover:bg-background/80 ${note.favorite ? "text-yellow-500 opacity-100" : "text-muted-foreground"}`}
          >
            <Star className={`size-3 ${note.favorite ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-2 h-8">
        {note.description ||
          note.content.substring(0, 150).replace(/[#*`]/g, "") ||
          "No content"}
      </p>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {Dates.yearMonthDay(note.updatedAt)}
        </span>
        {note.tagsList.length > 0 && (
          <div className="flex gap-1 overflow-hidden">
            {note.tagsList.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-primary/5 px-1 rounded text-primary/70 truncate max-w-[60px]"
              >
                #{tag}
              </span>
            ))}
            {note.tagsList.length > 2 && (
              <span>+{note.tagsList.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
};
