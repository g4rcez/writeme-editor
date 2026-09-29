import { Empty, Input, Modal, Shortcut, css } from "@g4rcez/components";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useListSearch } from "@/app/hooks/use-list-search";
import { getDirname } from "@/lib/file-utils";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { FILE_SEARCH_RESULT_LIMIT, type FileSearchEvent, type TreeNode } from "@/types/tree";

type ParentEntry = {
    type: "parent";
    name: "..";
    path: string;
};

type BrowserEntry = TreeNode | ParentEntry;

const normalizePath = (value: string): string => {
    const normalized = value.replace(/\\/g, "/");
    if (normalized === "/") return normalized;
    return normalized.replace(/\/+$/, "");
};

const getDirectoryName = (directory: string): string => {
    const parts = normalizePath(directory).split("/").filter(Boolean);
    return parts.at(-1) ?? directory;
};

const getRelativeWorkspacePath = (workspaceDirectory: string, entryPath: string): string => {
    const workspace = normalizePath(workspaceDirectory);
    const entry = normalizePath(entryPath);
    if (workspace === entry) return "";

    const prefix = workspace === "/" ? "/" : `${workspace}/`;
    return entry.startsWith(prefix) ? entry.slice(prefix.length) : entry;
};

const getDirectoryPrefix = (workspaceDirectory: string, entryPath: string): string => {
    const relativePath = getRelativeWorkspacePath(workspaceDirectory, entryPath);
    const separatorIndex = relativePath.lastIndexOf("/");
    return separatorIndex === -1 ? "" : relativePath.slice(0, separatorIndex + 1);
};

const getFileTitle = (filename: string): string => filename.replace(/\.[^.]+$/, "");

type SearchStatus = "idle" | "loading" | "complete" | "error";

let nextDirectorySearchRequestId = 0;

const createDirectorySearchRequestId = (): string => {
    nextDirectorySearchRequestId += 1;
    return `directory-search-${Date.now()}-${nextDirectorySearchRequestId}`;
};

export const DirectoryBrowserDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [homeDirectory, setHomeDirectory] = useState<string | null>(null);
    const [navigationPath, setNavigationPath] = useState<string | null>(null);
    const [entries, setEntries] = useState<TreeNode[]>([]);
    const [query, setQuery] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [searchEntries, setSearchEntries] = useState<TreeNode[]>([]);
    const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchTruncated, setSearchTruncated] = useState(false);
    const [loadedDirectory, setLoadedDirectory] = useState<string | null>(null);
    const [openingPath, setOpeningPath] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const workspaceDirectory = state.directory ?? homeDirectory;
    const currentDirectory = navigationPath ?? workspaceDirectory;
    const isLoading = Boolean(currentDirectory && loadedDirectory !== currentDirectory);
    const isSearching = query.trim().length > 0;

    const handleDialogChange = useCallback(
        (isOpen: boolean): void => {
            if (!isOpen) {
                setNavigationPath(null);
                setEntries([]);
                setLoadedDirectory(null);
                setQuery("");
                setError(null);
            }
            dispatch.directoryBrowserDialog(isOpen);
        },
        [dispatch],
    );

    const closeDialog = useCallback((): void => {
        handleDialogChange(false);
    }, [handleDialogChange]);

    useEffect(() => {
        if (!state.directoryBrowserDialog || state.directory || homeDirectory) return;
        void window.electronAPI.env.getHome().then(setHomeDirectory);
    }, [homeDirectory, state.directory, state.directoryBrowserDialog]);

    useEffect(() => {
        if (!state.directoryBrowserDialog) return;
        const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 10);
        return () => window.clearTimeout(timeoutId);
    }, [state.directoryBrowserDialog, workspaceDirectory]);

    useEffect(() => {
        if (!state.directoryBrowserDialog || !currentDirectory) return;

        let isCurrentRequest = true;
        void window.electronAPI.fs
            .readDir(currentDirectory)
            .then((result) => {
                if (!isCurrentRequest) return;
                setLoadedDirectory(currentDirectory);
                if (result.error) {
                    setEntries([]);
                    setError(result.error);
                    return;
                }
                setEntries(result.entries ?? []);
            })
            .catch((reason: unknown) => {
                if (!isCurrentRequest) return;
                setLoadedDirectory(currentDirectory);
                setEntries([]);
                setError(reason instanceof Error ? reason.message : "Failed to load directory");
            });

        return () => {
            isCurrentRequest = false;
        };
    }, [currentDirectory, state.directoryBrowserDialog]);

    useEffect(() => {
        const normalizedQuery = query.trim();
        if (!state.directoryBrowserDialog || !currentDirectory || !normalizedQuery) {
            setSearchEntries([]);
            setSearchStatus("idle");
            setSearchError(null);
            setSearchTruncated(false);
            return;
        }

        const fsApi = window.electronAPI.fs;
        const requestId = createDirectorySearchRequestId();
        let isCurrentRequest = true;

        setSearchEntries([]);
        setSearchStatus("loading");
        setSearchError(null);
        setSearchTruncated(false);

        const unsubscribe = fsApi.onFileSearchEvent((event: FileSearchEvent) => {
            if (!isCurrentRequest || event.requestId !== requestId) return;

            if (event.type === "batch") {
                startTransition(() => {
                    setSearchEntries((previous) => [...previous, ...event.entries]);
                });
                return;
            }

            if (event.type === "complete") {
                setSearchStatus("complete");
                setSearchTruncated(event.truncated);
                return;
            }

            setSearchStatus("error");
            setSearchError(event.error);
        });

        const timeoutId = window.setTimeout(() => {
            void fsApi
                .startFileSearch(currentDirectory, normalizedQuery, requestId)
                .then((result) => {
                    if (!isCurrentRequest || result.success) return;
                    setSearchStatus("error");
                    setSearchError(result.error);
                })
                .catch((reason: unknown) => {
                    if (!isCurrentRequest) return;
                    setSearchStatus("error");
                    setSearchError(reason instanceof Error ? reason.message : "Failed to search directory");
                });
        }, 180);

        return () => {
            isCurrentRequest = false;
            window.clearTimeout(timeoutId);
            unsubscribe();
            void fsApi.cancelFileSearch(requestId).catch(() => undefined);
        };
    }, [currentDirectory, query, state.directoryBrowserDialog]);

    const parentEntry = useMemo<ParentEntry | null>(() => {
        if (!workspaceDirectory || !currentDirectory) return null;
        if (!getRelativeWorkspacePath(workspaceDirectory, currentDirectory)) return null;

        return {
            type: "parent",
            name: "..",
            path: getDirname(currentDirectory),
        };
    }, [currentDirectory, workspaceDirectory]);

    const browserEntries = useMemo<BrowserEntry[]>(
        () => (parentEntry ? [parentEntry, ...entries] : entries),
        [entries, parentEntry],
    );

    const visibleEntries = useMemo<BrowserEntry[]>(
        () =>
            isSearching && (searchEntries.length > 0 || searchStatus === "complete") ? searchEntries : browserEntries,
        [browserEntries, isSearching, searchEntries, searchStatus],
    );

    const activeError = isSearching ? searchError : error;
    const isContentLoading = !isSearching && isLoading;
    const isWaitingForSearch =
        isSearching && searchEntries.length === 0 && (searchStatus === "idle" || searchStatus === "loading");

    const openFile = useCallback(
        async (node: TreeNode): Promise<void> => {
            setOpeningPath(node.path);
            try {
                const result = await window.electronAPI.fs.readFile(node.path);
                if (!result.success || typeof result.content !== "string") {
                    setError(result.error ?? "Failed to read file");
                    return;
                }

                const allNotes = await repositories.notes.getAll();
                const existingNote = allNotes.find((note) => note.filePath === node.path);
                if (existingNote) {
                    const fullNote = await repositories.notes.getOne(existingNote.id);
                    if (fullNote) {
                        await dispatch.note(fullNote);
                        closeDialog();
                        return;
                    }
                }

                const newNote = Note.new(getFileTitle(node.name), result.content);
                newNote.setFilePath(node.path, result.lastModified ? new Date(result.lastModified) : new Date());
                newNote.fileSize = typeof result.fileSize === "number" ? result.fileSize : result.content.length;
                await repositories.notes.save(newNote);
                await dispatch.note(newNote);
                closeDialog();
            } catch (reason: unknown) {
                setError(reason instanceof Error ? reason.message : "Failed to open file");
            } finally {
                setOpeningPath(null);
            }
        },
        [closeDialog, dispatch],
    );

    const selectEntry = useCallback(
        (entry: BrowserEntry): void => {
            if (entry.type === "parent" || entry.type === "directory") {
                setNavigationPath(entry.path);
                setEntries([]);
                setLoadedDirectory(null);
                setQuery("");
                setError(null);
                return;
            }
            void openFile(entry);
        },
        [openFile],
    );

    const { selectedIndex, setSelectedIndex } = useListSearch({
        items: visibleEntries,
        onSelect: selectEntry,
        isOpen: state.directoryBrowserDialog,
    });

    useEffect(() => {
        setSelectedIndex(0);
    }, [currentDirectory, query, setSelectedIndex]);

    useEffect(() => {
        if (!listRef.current || visibleEntries.length === 0) return;
        const selectedElement = listRef.current.children[selectedIndex] as HTMLElement | undefined;
        selectedElement?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex, visibleEntries]);

    const directoryName = currentDirectory ? getDirectoryName(currentDirectory) : "Browse Files";
    const relativeDirectory =
        workspaceDirectory && currentDirectory ? getRelativeWorkspacePath(workspaceDirectory, currentDirectory) : "";

    return (
        <Modal
            className="max-w-4xl"
            title={directoryName}
            onChange={handleDialogChange}
            open={state.directoryBrowserDialog}
            bodyClassName="overflow-hidden bg-background p-0"
        >
            <div className="flex h-[64vh] min-h-28 flex-col overflow-hidden">
                <div className="border-b border-floating-border px-5 py-4">
                    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">Select a file or directory.</p>
                            <p className="mt-1 truncate font-mono text-xs text-foreground/60">
                                {relativeDirectory ? `./${relativeDirectory}` : "./"}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Move</span>
                            <Shortcut value="↑ ↓" />
                            <span>Open</span>
                            <Shortcut value="Enter" />
                            <span>Close</span>
                            <Shortcut value="Esc" />
                        </div>
                    </div>

                    <Input
                        ref={inputRef}
                        type="text"
                        title="Search files and directories"
                        hiddenLabel
                        left={<MagnifyingGlassIcon className="size-4 text-muted-foreground" />}
                        right={
                            searchStatus === "loading" ? (
                                <span
                                    className="flex items-center text-muted-foreground"
                                    role="status"
                                    aria-label="Searching directory"
                                >
                                    <CircleNotchIcon className="size-4 animate-spin" aria-hidden="true" />
                                </span>
                            ) : undefined
                        }
                        placeholder="Search files and directories..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-background scrollbar-thin">
                    {!workspaceDirectory ? (
                        <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
                            <div>
                                <p className="font-medium text-foreground">No workspace directory configured.</p>
                                <p className="mt-2 text-sm">Open a workspace before browsing files.</p>
                            </div>
                        </div>
                    ) : isContentLoading ? (
                        <div className="flex h-full items-center justify-center gap-2 p-8 text-muted-foreground">
                            <CircleNotchIcon className="size-5 animate-spin" />
                            <span>Loading directory...</span>
                        </div>
                    ) : activeError ? (
                        <div className="flex h-full items-center justify-center p-8 text-center">
                            <div>
                                <p className="font-medium text-danger">
                                    {isSearching ? "Unable to search this directory" : "Unable to read this directory"}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">{activeError}</p>
                            </div>
                        </div>
                    ) : visibleEntries.length === 0 && !isWaitingForSearch ? (
                        <div className="flex h-full items-center justify-center p-8">
                            <Empty
                                Icon={MagnifyingGlassIcon}
                                message={
                                    query
                                        ? "No files or directories match your search"
                                        : "No files found in this directory"
                                }
                            />
                        </div>
                    ) : (
                        <ul ref={listRef} className="min-h-0 overflow-y-auto p-2">
                            {visibleEntries.map((entry, index) => {
                                const isParent = entry.type === "parent";
                                const relativePath = workspaceDirectory
                                    ? getRelativeWorkspacePath(workspaceDirectory, entry.path)
                                    : entry.name;
                                const directoryPrefix = isParent
                                    ? ""
                                    : getDirectoryPrefix(workspaceDirectory ?? "", entry.path);
                                const isOpening = entry.type === "file" && openingPath === entry.path;
                                const selected = index === selectedIndex;

                                return (
                                    <li key={entry.path}>
                                        <button
                                            type="button"
                                            className={css(
                                                "group grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-button-radius border px-3 py-2.5 text-left transition-colors",
                                                selected
                                                    ? "border-primary/35 bg-primary/10"
                                                    : "border-transparent hover:border-card-border hover:bg-muted/40",
                                            )}
                                            onClick={() => selectEntry(entry)}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter") return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                selectEntry(entry);
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            disabled={isOpening}
                                        >
                                            <span
                                                className={css(
                                                    "flex size-8 shrink-0 items-center justify-center rounded-button-radius transition-colors",
                                                    selected
                                                        ? "bg-primary/15 text-primary"
                                                        : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
                                                )}
                                            >
                                                {isParent ? (
                                                    <ArrowLeftIcon size={17} />
                                                ) : entry.type === "directory" ? (
                                                    <FolderSimpleIcon size={17} />
                                                ) : (
                                                    <FileIcon size={17} />
                                                )}
                                            </span>

                                            <span className="min-w-0">
                                                <span
                                                    className={css(
                                                        "block truncate text-sm font-semibold",
                                                        selected ? "text-primary" : "text-foreground",
                                                    )}
                                                >
                                                    {isParent ? "Parent directory" : entry.name}
                                                </span>
                                                {!isParent && directoryPrefix && (
                                                    <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                                                        {relativePath}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                            {isSearching && searchTruncated && (
                                <li className="px-3 py-2 text-center text-xs text-muted-foreground" role="status">
                                    Showing the first {FILE_SEARCH_RESULT_LIMIT.toLocaleString()} matches.
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            </div>
        </Modal>
    );
};
