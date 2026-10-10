import { Autocomplete } from "@g4rcez/components";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import type { FileSearchEntry, FileSearchEvent } from "@/types/tree";

const MAX_FOLDER_SUGGESTIONS = 8;
let nextFolderSearchRequestId = 0;

type SearchStatus = "idle" | "loading" | "complete" | "error";

type WorkspaceFolderAutocompleteProps = {
    workspaceDirectory: string;
    onSelectionChange: (folderPath: string | null, isPending: boolean) => void;
};

const normalizeRelativePath = (value: string): string => value.replace(/\\/g, "/");

export const WorkspaceFolderAutocomplete = ({
    workspaceDirectory,
    onSelectionChange,
}: WorkspaceFolderAutocompleteProps) => {
    const [query, setQuery] = useState("");
    const [entries, setEntries] = useState<FileSearchEntry[]>([]);
    const [status, setStatus] = useState<SearchStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
    const [autocompleteKey, setAutocompleteKey] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const autocompleteRef = useRef<HTMLInputElement>(null);
    const refocusAfterClear = useRef(false);

    const folders = useMemo(() => {
        const seen = new Set<string>();
        return entries
            .filter((entry) => entry.type === "directory")
            .filter((entry) => {
                if (seen.has(entry.path)) return false;
                seen.add(entry.path);
                return true;
            })
            .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
            .slice(0, MAX_FOLDER_SUGGESTIONS);
    }, [entries]);

    const options = useMemo(
        () =>
            folders.map((folder) => ({
                value: folder.path,
                label: `./${normalizeRelativePath(folder.relativePath)}`,
            })),
        [folders],
    );

    useEffect(() => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery || selectedFolderPath) {
            if (!selectedFolderPath) setEntries([]);
            setStatus("idle");
            setError(null);
            return;
        }

        const fsApi = window.electronAPI.fs;
        nextFolderSearchRequestId += 1;
        const requestId = `folder-autocomplete-${Date.now()}-${nextFolderSearchRequestId}`;
        let isCurrentRequest = true;

        setEntries([]);
        setStatus("loading");
        setError(null);

        const unsubscribe = fsApi.onFileSearchEvent((event: FileSearchEvent) => {
            if (!isCurrentRequest || event.requestId !== requestId) return;

            if (event.type === "batch") {
                setEntries((previous) => [...previous, ...event.entries]);
                return;
            }

            if (event.type === "complete") {
                setStatus("complete");
                return;
            }

            setStatus("error");
            setError(event.error);
        });

        const timeoutId = window.setTimeout(() => {
            void fsApi
                .startFileSearch(workspaceDirectory, normalizedQuery, requestId)
                .then((result) => {
                    if (!isCurrentRequest || result.success) return;
                    setStatus("error");
                    setError(result.error);
                })
                .catch((reason: unknown) => {
                    if (!isCurrentRequest) return;
                    setStatus("error");
                    setError(reason instanceof Error ? reason.message : "Failed to search folders");
                });
        }, 180);

        return () => {
            isCurrentRequest = false;
            window.clearTimeout(timeoutId);
            unsubscribe();
            void fsApi.cancelFileSearch(requestId).catch(() => undefined);
        };
    }, [query, selectedFolderPath, workspaceDirectory]);

    const selectFolder = (folder: FileSearchEntry): void => {
        setSelectedFolderPath(folder.path);
        onSelectionChange(folder.path, false);
    };

    const clearSelection = (): void => {
        setQuery("");
        setSelectedFolderPath(null);
        setEntries([]);
        setStatus("idle");
        setError(null);
        onSelectionChange(null, false);
    };

    const clearFolder = (): void => {
        clearSelection();
        refocusAfterClear.current = true;
        setAutocompleteKey((current) => current + 1);
    };

    const handleInputCapture = (event: SyntheticEvent<HTMLDivElement>): void => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;

        if (input === autocompleteRef.current) {
            if (!input.value) clearSelection();
            return;
        }

        const nextQuery = input.value;
        setQuery(nextQuery);
        setSelectedFolderPath(null);
        onSelectionChange(null, Boolean(nextQuery.trim()));
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const folder = folders.find((entry) => entry.path === event.target.value);
        if (folder) selectFolder(folder);
    };

    useEffect(() => {
        if (!refocusAfterClear.current) return;
        refocusAfterClear.current = false;
        containerRef.current?.querySelector<HTMLInputElement>('input[data-shadow="true"]')?.focus();
    }, [autocompleteKey]);

    const isPending = Boolean(query.trim() && !selectedFolderPath);

    const directoryCount = entries.filter((entry) => entry.type === "directory").length;
    const feedback =
        status === "loading"
            ? "Searching folders..."
            : directoryCount > folders.length
              ? `Choose a folder or refine your search to see the first ${MAX_FOLDER_SUGGESTIONS} matches. Leave this empty to save at the workspace root.`
              : "Choose an existing folder. Leave this empty to save at the workspace root.";

    return (
        <div ref={containerRef} className="flex flex-col gap-2" onInputCapture={handleInputCapture}>
            <Autocomplete
                key={autocompleteKey}
                ref={autocompleteRef}
                title="Folder (optional)"
                value={selectedFolderPath ?? ""}
                placeholder="Search workspace folders..."
                options={options}
                loading={status === "loading"}
                error={status === "error" ? `Could not search folders: ${error ?? "Unknown error"}` : undefined}
                emptyMessage={
                    status === "complete"
                        ? "No matching folders. Clear the search to use the workspace root."
                        : "Type to search workspace folders."
                }
                feedback={feedback}
                onChange={handleChange}
                right={
                    query || selectedFolderPath ? (
                        <button
                            type="button"
                            aria-label="Clear folder search"
                            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={clearFolder}
                        >
                            Clear
                        </button>
                    ) : null
                }
            />
            {isPending ? (
                <span className="sr-only">Select a matching folder or clear the search before creating the note.</span>
            ) : null}
        </div>
    );
};
