import { Empty, Input, Modal, Shortcut, css } from "@g4rcez/components";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode } from "@/types/tree";
import { useListSearch } from "@/app/hooks/use-list-search";
import { getDirname } from "@/lib/file-utils";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";

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

export const DirectoryBrowserDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [homeDirectory, setHomeDirectory] = useState<string | null>(null);
    const [navigationPath, setNavigationPath] = useState<string | null>(null);
    const [entries, setEntries] = useState<TreeNode[]>([]);
    const [query, setQuery] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loadedDirectory, setLoadedDirectory] = useState<string | null>(null);
    const [openingPath, setOpeningPath] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const workspaceDirectory = state.directory ?? homeDirectory;
    const currentDirectory = navigationPath ?? workspaceDirectory;
    const isLoading = Boolean(currentDirectory && loadedDirectory !== currentDirectory);

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

    const visibleEntries = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return browserEntries;

        return browserEntries.filter((entry) => {
            if (entry.type === "parent") return entry.name.includes(normalizedQuery);
            const relativePath = workspaceDirectory
                ? getRelativeWorkspacePath(workspaceDirectory, entry.path)
                : entry.name;
            return (
                entry.name.toLowerCase().includes(normalizedQuery) ||
                relativePath.toLowerCase().includes(normalizedQuery)
            );
        });
    }, [browserEntries, query, workspaceDirectory]);

    const openFile = useCallback(
        async (node: TreeNode): Promise<void> => {
            setOpeningPath(node.path);
            try {
                const result = await window.electronAPI.fs.readFile(node.path);
                if (!result.success) {
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

                const newNote = Note.new(getFileTitle(node.name), result.content ?? "");
                newNote.filePath = node.path;
                newNote.fileSize = result.fileSize;
                newNote.lastSynced = new Date(result.lastModified);
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
                    ) : isLoading ? (
                        <div className="flex h-full items-center justify-center gap-2 p-8 text-muted-foreground">
                            <CircleNotchIcon className="size-5 animate-spin" />
                            <span>Loading directory...</span>
                        </div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center p-8 text-center">
                            <div>
                                <p className="font-medium text-danger">Unable to read this directory</p>
                                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                            </div>
                        </div>
                    ) : visibleEntries.length === 0 ? (
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
                        </ul>
                    )}
                </div>
            </div>
        </Modal>
    );
};
