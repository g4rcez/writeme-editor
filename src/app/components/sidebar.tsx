import { useEffect, useState } from "react";
import {
  FileText,
  Clock,
  GripVertical,
} from "lucide-react";
import { clsx } from "clsx";
import { useUIStore } from "../../store/ui.store";
import { useGlobalStore, repositories } from "../../store/global.store";
import { Note } from "../../store/note";
import { SettingsService } from "../../store/settings";
import { formatSimplifiedPath, getRelativePath } from "../../lib/file-utils";
import { Modal } from "@g4rcez/components";
import { useNavigate } from "react-router-dom";

type SidebarSection = "recent" | "all";

type NoteListProps = {
  notes: Note[];
  currentNoteId?: string;
  onSelect: (note: Note) => void;
  getDisplayPath: (note: Note) => string;
};

const NoteList = ({
  notes,
  currentNoteId,
  onSelect,
  getDisplayPath,
}: NoteListProps) => (
  <ul className="space-y-0.5">
    {notes.map((note) => {
      const isActive = note.id === currentNoteId;
      const displayPath = getDisplayPath(note);
      return (
        <li key={note.id}>
          <button
            onClick={() => onSelect(note)}
            className={clsx(
              "w-full flex flex-col px-2 py-1.5 rounded-md text-left transition-colors",
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-foreground/70 hover:bg-muted/30 hover:text-foreground",
            )}
          >
            <span className="text-sm truncate">{note.title || "Untitled"}</span>
            {displayPath && (
              <span className="text-xs text-foreground/40 truncate">
                {displayPath}
              </span>
            )}
          </button>
        </li>
      );
    })}
  </ul>
);

export const Sidebar = () => {
  const [uiState, uiDispatch] = useUIStore();
  const [state, dispatch] = useGlobalStore();
  const [activeSection, setActiveSection] = useState<SidebarSection>("recent");
  const [isResizing, setIsResizing] = useState(false);
  const navigate = useNavigate();

  const settings = SettingsService.load();
  const storageDir = settings.storageDirectory || "";

  useEffect(() => {
    const loadNotes = async () => {
      const notes = await repositories.notes.getAll();
      dispatch.notes(notes);
      dispatch.loadRecentNotes(10);
    };
    loadNotes();
  }, [dispatch]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      uiDispatch.setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, uiDispatch]);

  const openNote = (note: Note) => {
    navigate(`/note/${note.id}`);
  };

  const getDisplayPath = (note: Note) => {
    if (!note.filePath || !storageDir) return "";
    const relativePath = getRelativePath(storageDir, note.filePath);
    const folderPath = relativePath.includes("/")
      ? relativePath.substring(0, relativePath.lastIndexOf("/"))
      : "";
    return formatSimplifiedPath(folderPath);
  };

  return (
    <Modal
      type="drawer"
      position="left"
      title="Quick actions"
      open={uiState.sidebarOpen}
      onChange={uiDispatch.toggleSidebar}
    >
      <aside className="flex flex-col h-full">
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setActiveSection("recent")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors",
              activeSection === "recent"
                ? "text-foreground border-b-2 border-primary"
                : "text-foreground/50 hover:text-foreground",
            )}
            title="Recent notes"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent</span>
          </button>
          <button
            onClick={() => setActiveSection("all")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors",
              activeSection === "all"
                ? "text-foreground border-b-2 border-primary"
                : "text-foreground/50 hover:text-foreground",
            )}
            title="All notes"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>All</span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-2">
          {activeSection === "recent" && (
            <NoteList
              notes={state.recentNotes}
              currentNoteId={state.note?.id}
              onSelect={openNote}
              getDisplayPath={getDisplayPath}
            />
          )}

          {activeSection === "all" && (
            <NoteList
              notes={state.notes}
              currentNoteId={state.note?.id}
              onSelect={openNote}
              getDisplayPath={getDisplayPath}
            />
          )}

          {state.notes.length === 0 && (
            <div className="flex flex-col justify-center items-center p-4 h-full text-center text-foreground/50">
              <FileText className="mb-2 w-8 h-8 opacity-50" />
              <p className="text-sm">No notes yet</p>
              <p className="text-xs">Create one with ⌘N</p>
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className={clsx(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize group",
            isResizing && "bg-primary/50",
          )}
        >
          <div className="absolute right-0 top-1/2 opacity-0 transition-opacity -translate-y-1/2 group-hover:opacity-100">
            <GripVertical className="w-3 h-3 text-foreground/30" />
          </div>
        </div>
      </aside>
    </Modal>
  );
};
