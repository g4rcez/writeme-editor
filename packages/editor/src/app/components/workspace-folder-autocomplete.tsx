import { Input } from "@g4rcez/components";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
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
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
    const listboxId = useId();

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

    useEffect(() => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery || selectedFolderPath) {
            setEntries([]);
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
        setSelectedIndex(0);

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
        const relativePath = normalizeRelativePath(folder.relativePath);
        setQuery(relativePath);
        setSelectedFolderPath(folder.path);
        setIsOpen(false);
        onSelectionChange(folder.path, false);
    };

    const clearFolder = (): void => {
        setQuery("");
        setSelectedFolderPath(null);
        setIsOpen(false);
        onSelectionChange(null, false);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Escape") {
            setIsOpen(false);
            return;
        }
        if (!isOpen || folders.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) => Math.min(current + 1, folders.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === "Enter") {
            const folder = folders[selectedIndex];
            if (!folder) return;
            event.preventDefault();
            event.stopPropagation();
            selectFolder(folder);
        }
    };

    const activeOptionId = isOpen && folders[selectedIndex] ? `${listboxId}-option-${selectedIndex}` : undefined;
    const isPending = Boolean(query.trim() && isOpen);

    return (
        <div className="relative flex flex-col gap-2">
            <Input
                title="Folder (optional)"
                value={query}
                placeholder="Search workspace folders..."
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={Boolean(isOpen && query.trim())}
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                aria-describedby={`${listboxId}-help`}
                onFocus={() => setIsOpen(Boolean(query.trim() && !selectedFolderPath))}
                onChange={(event) => {
                    const nextQuery = event.target.value;
                    setQuery(nextQuery);
                    setSelectedFolderPath(null);
                    setIsOpen(Boolean(nextQuery.trim()));
                    onSelectionChange(null, Boolean(nextQuery.trim()));
                }}
                onKeyDown={handleKeyDown}
                right={
                    query ? (
                        <button
                            type="button"
                            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Clear folder search"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={clearFolder}
                        >
                            Clear
                        </button>
                    ) : null
                }
            />
            <p id={`${listboxId}-help`} className="text-xs leading-5 text-muted-foreground">
                Choose an existing folder. Leave this empty to save at the workspace root.
            </p>

            {isOpen && query.trim() && (
                <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-card-border bg-floating-background shadow-lg">
                    {status === "loading" && (
                        <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                            Searching folders...
                        </p>
                    )}
                    {status === "error" && (
                        <p className="px-3 py-2 text-sm text-danger" role="alert">
                            Could not search folders: {error}
                        </p>
                    )}
                    {status === "complete" && folders.length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                            No matching folders. Clear the search to use the workspace root.
                        </p>
                    )}
                    {folders.length > 0 && (
                        <ul
                            id={listboxId}
                            role="listbox"
                            aria-label="Workspace folders"
                            className="max-h-56 overflow-y-auto p-1"
                        >
                            {folders.map((folder, index) => {
                                const relativePath = normalizeRelativePath(folder.relativePath);
                                const isSelected = selectedIndex === index;
                                return (
                                    <li
                                        key={folder.path}
                                        id={`${listboxId}-option-${index}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        tabIndex={-1}
                                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                                            isSelected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                                        }`}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        onClick={() => selectFolder(folder)}
                                    >
                                        <FolderSimpleIcon size={16} aria-hidden="true" />
                                        <span className="truncate">./{relativePath}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {status === "complete" &&
                        entries.filter((entry) => entry.type === "directory").length > folders.length && (
                            <p
                                className="border-t border-card-border px-3 py-2 text-xs text-muted-foreground"
                                role="status"
                            >
                                Showing {MAX_FOLDER_SUGGESTIONS} matches. Refine your search to see more.
                            </p>
                        )}
                </div>
            )}
            {isPending && status === "complete" && folders.length === 0 ? (
                <span className="sr-only">Select a matching folder or clear the search before creating the note.</span>
            ) : null}
        </div>
    );
};
