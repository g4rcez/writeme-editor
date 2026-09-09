import { Input } from "@g4rcez/components";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TextTIcon } from "@phosphor-icons/react/dist/csr/TextT";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { filterNotesByQuery } from "@/lib/note-search";
import { globalDispatch, useGlobalStore } from "@/store/global.store";

export const SearchPane = () => {
    const [{ searchQuery }, layoutDispatch] = useLayoutStore((s) => ({
        searchQuery: s.searchQuery,
    }));
    const [globalState] = useGlobalStore();
    const [localQuery, setLocalQuery] = useState("");
    const navigate = useNavigate();

    const filteredNotes = useMemo(
        () => filterNotesByQuery(globalState.notes, searchQuery),
        [globalState.notes, searchQuery],
    );

    const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        layoutDispatch.setSearch(e.target.value);
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-background/50">
            <div className="flex items-center justify-between border-b border-border/40 px-1 py-2">
                <span className="text-xs font-medium text-foreground">Search</span>
                <span className="font-mono text-[10px] text-muted-foreground/60">⌘K</span>
            </div>
            <div className="space-y-3 px-1 py-3">
                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            optionalText=" "
                            value={searchQuery}
                            title="Global search"
                            onChange={handleGlobalSearch}
                            placeholder="Search all notes…"
                            right={<MagnifyingGlassIcon className="size-4 text-muted-foreground" />}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            optionalText=" "
                            value={localQuery}
                            title="In current note"
                            placeholder="Find in note…"
                            onChange={(e) => setLocalQuery(e.target.value)}
                            right={<TextTIcon className="size-4 text-muted-foreground" />}
                        />
                    </div>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                <div className="mb-2 flex items-center justify-between px-2 font-medium uppercase text-[10px] tracking-[0.1em] text-muted-foreground">
                    <span>Results</span>
                    <span>{filteredNotes.length}</span>
                </div>
                {globalState.notes.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                        <FileTextIcon size={22} className="text-muted-foreground/60" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-medium text-foreground">No notes yet</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Create your first note to search it here.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => globalDispatch.setCreateNoteDialog({ isOpen: true, type: "note" })}
                            className="min-h-9 rounded-md border border-border/50 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            Create note
                        </button>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <p className="text-sm font-medium text-foreground">No matching notes</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Try a different search term.</p>
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {filteredNotes.map((note) => (
                            <li key={note.id}>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/note/${note.id}`)}
                                    className="group flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <FileTextIcon
                                        size={16}
                                        className="shrink-0 text-muted-foreground group-hover:text-primary"
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{note.title || "Untitled"}</div>
                                        <div className="truncate text-[10px] text-muted-foreground">
                                            {note.content.substring(0, 100).replace(/[#*`]/g, "")}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
