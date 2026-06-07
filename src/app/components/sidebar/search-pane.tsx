import { useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { TextTIcon } from "@phosphor-icons/react/dist/csr/TextT";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { useGlobalStore } from "@/store/global.store";
import { useNavigate } from "react-router-dom";
import type { Note } from "@/store/note";
import { Input } from "@g4rcez/components";

export const SearchPane = () => {
  const [{ searchQuery }, layoutDispatch] = useLayoutStore((s) => ({
    searchQuery: s.searchQuery,
  }));
  const [globalState] = useGlobalStore();
  const [localQuery, setLocalQuery] = useState("");
  const navigate = useNavigate();

  const filteredNotes = globalState.notes.filter((note: Note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    layoutDispatch.setSearch(e.target.value);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background/50">
      <div className="py-2 px-4 border-b border-border/20">
        <span className="text-xs text-muted-foreground">Search</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Input
              optionalText=" "
              value={searchQuery}
              title="Global search"
              onChange={handleGlobalSearch}
              placeholder="Search all notes..."
              right={
                <MagnifyingGlassIcon className="size-4 text-muted-foreground" />
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <Input
              optionalText=" "
              value={localQuery}
              title="In current note"
              placeholder="Find in note..."
              onChange={(e) => setLocalQuery(e.target.value)}
              right={<TextTIcon className="size-4 text-muted-foreground" />}
            />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 mb-2 font-medium uppercase text-[10px] text-muted-foreground">
          Results ({filteredNotes.length})
        </div>
        <ul className="space-y-1">
          {filteredNotes.map((note: Note) => (
            <li key={note.id}>
              <button
                onClick={() => navigate(`/note/${note.id}`)}
                className="flex gap-3 items-center py-2 px-2 w-full text-left rounded-md transition-colors group hover:bg-muted/50"
              >
                <FileTextIcon
                  size={16}
                  className="text-muted-foreground shrink-0 group-hover:text-primary"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {note.title || "Untitled"}
                  </div>
                  <div className="opacity-70 text-[10px] text-muted-foreground truncate">
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
