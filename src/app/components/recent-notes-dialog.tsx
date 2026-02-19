import { useEffect, useState, useRef, useCallback } from "react";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { Search } from "lucide-react";
import { Modal } from "@g4rcez/components";
import { useNavigate } from "react-router-dom";
import { useListSearch } from "@/app/hooks/use-list-search";

export const RecentNotesDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  const closeDialog = useCallback(() => {
    dispatch.recentNotesDialog(false);
  }, [dispatch]);

  const openNote = useCallback(
    (note: Note) => {
      navigate(`/note/${note.id}`);
      closeDialog();
    },
    [navigate, closeDialog],
  );

  // Load recent notes when dialog opens
  useEffect(() => {
    if (state.recentNotesDialog) {
      dispatch.loadRecentNotes();
      setQuery("");
      // Small delay to ensure render
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [state.recentNotesDialog, dispatch]);

  const settings = SettingsService.load();
  const storageDir = settings.storageDirectory || "";

  // Filter notes
  const filteredNotes = state.recentNotes.filter((note) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    const titleMatch = note.title.toLowerCase().includes(lowerQuery);

    let pathMatch = false;
    if (note.filePath) {
      pathMatch = note.filePath.toLowerCase().includes(lowerQuery);
    }

    return titleMatch || pathMatch;
  });

  const { selectedIndex, setSelectedIndex } = useListSearch({
    items: filteredNotes,
    onSelect: openNote,
    isOpen: state.recentNotesDialog,
  });

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredNotes.length > 0) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, filteredNotes]);

  return (
    <Modal
      open={state.recentNotesDialog}
      onChange={(val) => dispatch.recentNotesDialog(val)}
      title="Recent Notes"
    >
      <div className="flex flex-col h-[60vh]">
        <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-lg placeholder-gray-400 dark:text-white"
            placeholder="Search recent notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
          <div className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded">
            Esc to close
          </div>
        </div>

        <ul ref={listRef} className="overflow-y-auto flex-1 p-2 scrollbar-thin">
          {filteredNotes.map((note, index) => {
            const relativePath =
              note.filePath && storageDir
                ? getRelativePath(storageDir, note.filePath)
                : "";

            // Remove filename from path for display
            const folderPath = relativePath.includes("/")
              ? relativePath.substring(0, relativePath.lastIndexOf("/"))
              : "";

            const displayPath = formatSimplifiedPath(folderPath);

            return (
              <li
                key={note.id}
                className={`flex flex-col px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
                onClick={() => openNote(note)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-medium ${
                      index === selectedIndex
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {note.title || "Untitled"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {displayPath && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {displayPath}
                  </div>
                )}
              </li>
            );
          })}

          {filteredNotes.length === 0 && (
            <div className="p-8 text-center text-gray-500">No notes found</div>
          )}
        </ul>
      </div>
    </Modal>
  );
};
