import { Button, Input } from "@g4rcez/components";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TextTIcon } from "@phosphor-icons/react/dist/csr/TextT";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { mapShortcutOS } from "@/app/elements/shortcut-items";
import { useListSearch } from "@/app/hooks/use-list-search";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { filterNotesByQuery, getNoteSearchSnippet } from "@/lib/note-search";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { SettingsService } from "@/store/settings";
import { uiDispatch } from "@/store/ui.store";

function getSearchResultLocation(filePath: string | null | undefined, workspaceDirectory: string): string {
    if (!filePath) return "Local note";
    const path = workspaceDirectory ? getRelativePath(workspaceDirectory, filePath) : filePath;
    return formatSimplifiedPath(path) || path;
}

export const SearchPane = () => {
    const [{ searchQuery }, layoutDispatch] = useLayoutStore((s) => ({
        searchQuery: s.searchQuery,
    }));
    const [globalState] = useGlobalStore();
    const [searchFocused, setSearchFocused] = useState(false);
    const navigate = useNavigate();
    const workspaceDirectory = SettingsService.load().directory ?? "";

    const filteredNotes = useMemo(
        () => filterNotesByQuery(globalState.notes, searchQuery),
        [globalState.notes, searchQuery],
    );
    const selectNote = useCallback((note: (typeof filteredNotes)[number]) => navigate(`/note/${note.id}`), [navigate]);
    const { selectedIndex, setSelectedIndex } = useListSearch({
        items: filteredNotes,
        onSelect: selectNote,
        isOpen: searchFocused && searchQuery.trim().length > 0,
    });

    const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        layoutDispatch.setSearch(e.target.value);
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-background/50">
            <div className="border-b border-border/40 px-1 py-2">
                <span className="text-xs font-medium text-foreground">Search notes</span>
            </div>
            <div className="space-y-3 px-1 py-3">
                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            optionalText=" "
                            autoFocus
                            value={searchQuery}
                            title="Search notes"
                            onChange={handleGlobalSearch}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            placeholder="Search titles, content, tags, or paths…"
                            right={<MagnifyingGlassIcon className="size-4 text-muted-foreground" />}
                        />
                    </div>
                </div>
                <Button
                    type="button"
                    size="small"
                    theme="ghost-muted"
                    className="w-full justify-start gap-2"
                    disabled={!globalState.note}
                    onClick={() => uiDispatch.toggleFindReplace()}
                >
                    <TextTIcon className="size-4" aria-hidden="true" />
                    <span>Find in current note</span>
                    <kbd className="ml-auto text-[10px] text-muted-foreground">{mapShortcutOS("mod+f")}</kbd>
                </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                <div className="mb-2 flex items-center justify-between px-2 font-medium uppercase text-[10px] tracking-[0.1em] text-muted-foreground">
                    <span>All notes</span>
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
                        <p className="text-sm font-medium text-foreground">No notes match</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Search checks titles, content, tags, and paths.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {filteredNotes.map((note, index) => {
                            const location = getSearchResultLocation(note.filePath, workspaceDirectory);
                            const selected = index === selectedIndex;
                            return (
                                <li key={note.id}>
                                    <button
                                        type="button"
                                        aria-current={selected ? "true" : undefined}
                                        onClick={() => selectNote(note)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`group flex min-h-14 w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/10" : ""}`}
                                    >
                                        <FileTextIcon
                                            size={16}
                                            className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {note.title || "Untitled"}
                                            </span>
                                            <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                {getNoteSearchSnippet(note.content, searchQuery)}
                                            </span>
                                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/75">
                                                {location}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
