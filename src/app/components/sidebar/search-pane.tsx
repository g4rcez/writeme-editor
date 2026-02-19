import { useState, useEffect } from "react";
import { Search, FileText, Type } from "lucide-react";
import { useLayoutContext } from "@/app/contexts/layout-context";
import { useGlobalStore } from "@/store/global.store";
import { useNavigate } from "react-router-dom";
import { Note } from "@/store/note";

export const SearchPane = () => {
  const { state: layoutState, dispatch: layoutDispatch } = useLayoutContext();
  const [globalState] = useGlobalStore();
  const [localQuery, setLocalQuery] = useState("");
  const navigate = useNavigate();

  // Filter notes based on global search query
  const filteredNotes = globalState.notes.filter((note: Note) => {
    const query = layoutState.searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    layoutDispatch({ type: "SET_SEARCH", query: e.target.value });
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="px-4 py-2 border-b border-border/20">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Search
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Global Search */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">
            Global Search
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search all notes..."
              value={layoutState.searchQuery}
              onChange={handleGlobalSearch}
              className="w-full bg-muted/40 text-sm pl-9 pr-3 py-1.5 rounded-md border border-transparent focus:border-primary/50 outline-none transition-all"
            />
          </div>
        </div>

        {/* Local Search (Current Note) */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">
            In Current Note
          </label>
          <div className="relative">
            <Type className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find in note..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="w-full bg-muted/40 text-sm pl-9 pr-3 py-1.5 rounded-md border border-transparent focus:border-primary/50 outline-none transition-all"
            />
          </div>
          {/* TODO: Integration with TipTap Search extension */}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 mb-2 text-[10px] font-medium text-muted-foreground uppercase">
          Results ({filteredNotes.length})
        </div>
        <ul className="space-y-1">
          {filteredNotes.map((note: Note) => (
            <li key={note.id}>
              <button
                onClick={() => navigate(`/note/${note.id}`)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 text-left transition-colors group"
              >
                <FileText
                  size={16}
                  className="text-muted-foreground group-hover:text-primary shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {note.title || "Untitled"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate opacity-70">
                    {note.content.substring(0, 100).replace(/[#*`]/g, "")}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
