import { Button, Input } from "@g4rcez/components";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TextTIcon } from "@phosphor-icons/react/dist/csr/TextT";
import { useCallback, useMemo, useRef, useState, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { mapShortcutOS } from "@/app/elements/shortcut-items";
import { EscapeLevel, useEscapeLayer } from "@/app/hooks/use-escape-layer";
import { useListSearch } from "@/app/hooks/use-list-search";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { filterNotesByQuery, getNoteSearchSnippet } from "@/lib/note-search";
import {
    buildNoteSearchFilterQuery,
    EMPTY_NOTE_SEARCH_FILTERS,
    filterNotesByStructuredFilters,
    getActiveNoteSearchFilterCount,
    getNoteSearchFolders,
    type NoteSearchFilters,
} from "@/lib/note-search-filters";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { NoteType } from "@/store/note";
import { repositories } from "@/store/repositories";
import { View } from "@/store/repositories/entities/view";
import { SettingsService } from "@/store/settings";
import { uiDispatch } from "@/store/ui.store";

function getSearchResultLocation(filePath: string | null | undefined, workspaceDirectory: string): string {
    if (!filePath) return "Local note";
    const path = workspaceDirectory ? getRelativePath(workspaceDirectory, filePath) : filePath;
    return formatSimplifiedPath(path) || path;
}

function getNoteSearchFilterLabels(filters: NoteSearchFilters): Array<{ key: string; label: string }> {
    return [
        ...filters.tags.map((tag) => ({ key: `tag:${tag}`, label: `Tag: ${tag}` })),
        ...(filters.noteType ? [{ key: "type", label: `Type: ${filters.noteType}` }] : []),
        ...(filters.location
            ? [{ key: "location", label: `Location: ${filters.location.replace(/^folder:/u, "")}` }]
            : []),
        ...(filters.updatedAfter ? [{ key: "after", label: `Updated on or after: ${filters.updatedAfter}` }] : []),
        ...(filters.updatedBefore ? [{ key: "before", label: `Updated through: ${filters.updatedBefore}` }] : []),
    ];
}

export const SearchPane = () => {
    const [{ searchQuery }, layoutDispatch] = useLayoutStore((s) => ({
        searchQuery: s.searchQuery,
    }));
    const [globalState] = useGlobalStore((state) => ({ notes: state.notes, note: state.note }));
    const [searchFocused, setSearchFocused] = useState(false);
    const [filters, setFilters] = useState<NoteSearchFilters>(EMPTY_NOTE_SEARCH_FILTERS);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveTitle, setSaveTitle] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const saveButton = useRef<HTMLButtonElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const focusSaveTitle = useCallback((input: HTMLInputElement | null): void => {
        input?.focus();
    }, []);
    const navigate = useNavigate();
    const workspaceDirectory = SettingsService.load().directory ?? "";
    const activeFilterCount = getActiveNoteSearchFilterCount(filters);
    const folderOptions = useMemo(
        () => getNoteSearchFolders(globalState.notes.map(({ filePath }) => filePath)),
        [globalState.notes],
    );
    const availableTags = useMemo(
        () => Array.from(new Set(globalState.notes.flatMap(({ tags }) => tags))).sort((a, b) => a.localeCompare(b)),
        [globalState.notes],
    );
    // typing stays responsive: matching re-runs for the settled query instead of every keystroke
    const deferredQuery = useDeferredValue(searchQuery);
    const textMatches = useMemo(
        () => filterNotesByQuery(globalState.notes, deferredQuery),
        [globalState.notes, deferredQuery],
    );
    const snippets = useMemo(() => new Map<string, string>(), [deferredQuery]);
    const snippetFor = (note: { id: string; updatedAt: Date; content: string }): string => {
        const key = `${note.id}:${+note.updatedAt}`;
        let snippet = snippets.get(key);
        if (snippet === undefined) {
            snippet = getNoteSearchSnippet(note.content, deferredQuery);
            snippets.set(key, snippet);
        }
        return snippet;
    };
    const { filteredNotes, filterError } = useMemo(() => {
        try {
            return { filteredNotes: filterNotesByStructuredFilters(textMatches, filters), filterError: null };
        } catch (error) {
            return {
                filteredNotes: [],
                filterError: error instanceof Error ? error.message : "Check the selected filters.",
            };
        }
    }, [filters, textMatches]);
    const hasTextSearch = searchQuery.trim().length > 0;
    const closeSaveForm = (): void => {
        if (saving) return;
        setShowSaveForm(false);
        saveButton.current?.focus();
    };
    useEscapeLayer(EscapeLevel.panel, showSaveForm, closeSaveForm);
    const selectNote = useCallback((note: (typeof filteredNotes)[number]) => navigate(`/note/${note.id}`), [navigate]);
    const { selectedIndex, setSelectedIndex } = useListSearch({
        items: filteredNotes,
        onSelect: selectNote,
        isOpen: searchFocused && (searchQuery.trim().length > 0 || activeFilterCount > 0),
    });

    const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        layoutDispatch.setSearch(e.target.value);
    };

    const removeFilter = (key: string) => {
        setFilters((current) => {
            if (key.startsWith("tag:")) {
                return { ...current, tags: current.tags.filter((tag) => `tag:${tag}` !== key) };
            }
            if (key === "type") return { ...current, noteType: "" };
            if (key === "location") return { ...current, location: "" };
            if (key === "after") return { ...current, updatedAfter: "" };
            return { ...current, updatedBefore: "" };
        });
        if (activeFilterCount === 1) setShowSaveForm(false);
        searchInput.current?.focus();
    };

    const saveAsView = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const title = saveTitle.trim();
        if (!title || activeFilterCount === 0 || hasTextSearch || filterError || saving) return;
        setSaving(true);
        setSaveError(null);
        try {
            const now = new Date();
            const view = new View(
                crypto.randomUUID(),
                title,
                buildNoteSearchFilterQuery(filters),
                [{ field: "title", label: "Title" }],
                "table",
                "updatedAt",
                "DESC",
                {},
                now,
                now,
            );
            await repositories.views.save(view);
            setSaveTitle("");
            setShowSaveForm(false);
            navigate(`/views/${view.id}`);
            if (window.matchMedia("(max-width: 767px)").matches) uiDispatch.setSidebarOpen(false);
        } catch {
            setSaveError("Could not save this View. Check storage and try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section
            aria-label="Search notes"
            className="writeme-search-pane flex h-full min-h-0 flex-col overflow-y-auto bg-background/50"
        >
            <div className="border-b border-border/40 px-1 py-2">
                <span className="text-xs font-medium text-foreground">Search notes</span>
            </div>
            <div className="space-y-3 px-1 py-3">
                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            ref={searchInput}
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
                    <p className="text-[11px] leading-4 text-muted-foreground">
                        Search titles, content, tags, and paths. Combine filters to narrow the results.
                    </p>
                </div>
                <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-2">
                    <legend className="mb-2 text-xs font-medium text-foreground">Filters</legend>
                    <label className="space-y-1 text-xs text-muted-foreground">
                        <span>Tag</span>
                        <select
                            aria-label="Add tag filter"
                            value=""
                            onChange={(event) => {
                                const tag = event.target.value;
                                if (tag && !filters.tags.includes(tag))
                                    setFilters((current) => ({ ...current, tags: [...current.tags, tag] }));
                            }}
                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="">Choose a tag</option>
                            {availableTags.map((tag) => (
                                <option key={tag} value={tag}>
                                    {tag}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                        <span>Note type</span>
                        <select
                            aria-label="Filter by note type"
                            value={filters.noteType}
                            onChange={(event) =>
                                setFilters((current) => ({ ...current, noteType: event.target.value }))
                            }
                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="">All types</option>
                            {Object.values(NoteType).map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                        <span>Folder or location</span>
                        <select
                            aria-label="Filter by folder or location"
                            value={filters.location}
                            onChange={(event) =>
                                setFilters((current) => ({ ...current, location: event.target.value }))
                            }
                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="">All locations</option>
                            <option value="local">Local notes (database)</option>
                            <option value="filesystem">Files on disk</option>
                            {folderOptions.map(({ path, label }) => (
                                <option key={path} value={`folder:${path}`}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                        <span>Updated on or after</span>
                        <input
                            aria-label="Updated on or after"
                            type="date"
                            value={filters.updatedAfter}
                            onChange={(event) =>
                                setFilters((current) => ({ ...current, updatedAfter: event.target.value }))
                            }
                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                        <span>Updated through</span>
                        <input
                            aria-label="Updated through"
                            type="date"
                            value={filters.updatedBefore}
                            onChange={(event) =>
                                setFilters((current) => ({ ...current, updatedBefore: event.target.value }))
                            }
                            className="min-h-9 w-full rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </label>
                </fieldset>
                {filterError && (
                    <p role="alert" className="text-xs text-danger">
                        {filterError}
                    </p>
                )}
                {activeFilterCount > 0 && (
                    <div className="space-y-2" aria-label="Active search filters">
                        <div className="flex flex-wrap gap-1.5">
                            {getNoteSearchFilterLabels(filters).map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-label={`Remove ${label} filter`}
                                    onClick={() => removeFilter(key)}
                                    disabled={saving}
                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <span className="truncate">{label}</span>
                                    <span aria-hidden="true" className="text-muted-foreground">
                                        ×
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="small"
                                theme="ghost-muted"
                                disabled={saving}
                                onClick={() => {
                                    setFilters(EMPTY_NOTE_SEARCH_FILTERS);
                                    setShowSaveForm(false);
                                    setSaveError(null);
                                    searchInput.current?.focus();
                                }}
                            >
                                Reset filters
                            </Button>
                            <Button
                                ref={saveButton}
                                type="button"
                                size="small"
                                theme="muted"
                                disabled={saving || Boolean(filterError)}
                                aria-expanded={showSaveForm}
                                onClick={() => setShowSaveForm(true)}
                            >
                                Save as View
                            </Button>
                        </div>
                        {showSaveForm && (
                            <form onSubmit={saveAsView} className="space-y-2 rounded-md border border-border/60 p-2">
                                <Input
                                    ref={focusSaveTitle}
                                    id="search-view-title"
                                    title="View title"
                                    value={saveTitle}
                                    onChange={(event) => setSaveTitle(event.target.value)}
                                    placeholder="e.g. Project reading"
                                    required
                                    disabled={saving}
                                />
                                <p className="text-[11px] leading-4 text-muted-foreground">
                                    Saves all selected tags, note type, location, and updated dates. Results update as
                                    your notes change.
                                </p>
                                {hasTextSearch && (
                                    <div className="space-y-2">
                                        <output className="block text-xs text-muted-foreground">
                                            Views preserve filters only. Clear text search before saving to keep the
                                            same results.
                                        </output>
                                        <Button
                                            type="button"
                                            size="small"
                                            theme="muted"
                                            onClick={() => layoutDispatch.setSearch("")}
                                        >
                                            Clear text search and keep filters
                                        </Button>
                                    </div>
                                )}
                                {saveError && (
                                    <p role="alert" className="text-xs text-danger">
                                        {saveError}
                                    </p>
                                )}
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                        type="button"
                                        size="small"
                                        theme="ghost-muted"
                                        disabled={saving}
                                        onClick={closeSaveForm}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="small"
                                        theme="primary"
                                        disabled={!saveTitle.trim() || saving || hasTextSearch || Boolean(filterError)}
                                    >
                                        {saving ? "Saving…" : "Create View"}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
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
            <div className="px-2 pb-4">
                <div className="mb-2 flex items-center justify-between px-2 font-medium uppercase text-[10px] tracking-[0.1em] text-muted-foreground">
                    <span>{activeFilterCount || hasTextSearch ? "Matching notes" : "All notes"}</span>
                    <span aria-live="polite">{filteredNotes.length}</span>
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
                            Adjust or reset the filters to broaden this search.
                        </p>
                    </div>
                ) : (
                    <ul aria-label="Search results" className="space-y-0.5">
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
                                                {snippetFor(note)}
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
        </section>
    );
};
