import type React from "react";
import { Tooltip, Button } from "@g4rcez/components";
import { BracketsCurlyIcon, PencilRulerIcon } from "@phosphor-icons/react";
import { BookmarkIcon } from "@phosphor-icons/react/dist/csr/Bookmark";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { FilePdfIcon } from "@phosphor-icons/react/dist/csr/FilePdf";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FilmStripIcon } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { SpinnerIcon } from "@phosphor-icons/react/dist/csr/Spinner";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useReducedMotion } from "motion/react";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { TreeNode, FlattenedNode } from "@/types/tree";
import { Prompt } from "@/app/components/prompt";
import { isElectron } from "@/lib/is-electron";
import { NoteType, type Note } from "@/store/note";

interface FileExtensionConfig {
    icon: React.ElementType;
    iconClass: string;
    selectable: boolean;
}

const FILE_EXTENSION_CONFIGS: Record<string, FileExtensionConfig> = {
    ".md": {
        icon: FileTextIcon,
        iconClass: "text-foreground/70 size-4",
        selectable: true,
    },
    ".json": {
        icon: BracketsCurlyIcon,
        iconClass: "text-warn size-4",
        selectable: true,
    },
    ".png": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".jpg": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".jpeg": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".gif": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".webp": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".svg": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".bmp": {
        icon: ImageIcon,
        iconClass: "text-info size-4",
        selectable: true,
    },
    ".mp4": {
        icon: FilmStripIcon,
        iconClass: "text-primary size-4",
        selectable: true,
    },
    ".webm": {
        icon: FilmStripIcon,
        iconClass: "text-primary size-4",
        selectable: true,
    },
    ".ogg": {
        icon: FilmStripIcon,
        iconClass: "text-primary size-4",
        selectable: true,
    },
    ".mov": {
        icon: FilmStripIcon,
        iconClass: "text-primary size-4",
        selectable: true,
    },
    ".pdf": {
        icon: FilePdfIcon,
        iconClass: "text-danger size-4",
        selectable: true,
    },
};

const FILE_NAME_CONFIGS: Record<string, FileExtensionConfig> = {
    excalidraw: {
        selectable: true,
        icon: PencilRulerIcon,
        iconClass: "text-info size-4",
    },
    "agents.md": {
        icon: RobotIcon,
        selectable: true,
        iconClass: "text-primary size-4",
    },
    "claude.md": {
        icon: RobotIcon,
        selectable: true,
        iconClass: "text-primary size-4",
    },
    "readme.md": {
        selectable: true,
        icon: BookmarkIcon,
        iconClass: "text-warn size-4",
    },
};

const getFileConfig = (node: TreeNode, note: Note | null) => {
    if (note?.noteType === NoteType.excalidraw) {
        return FILE_NAME_CONFIGS.excalidraw;
    }
    return FILE_NAME_CONFIGS[node.name.toLowerCase()] ?? FILE_EXTENSION_CONFIGS[node.extension?.toLowerCase() ?? ""];
};

const TREE_NODE_DRAG_TYPE = "application/x-writeme-tree-node-path";

const getPathBaseName = (path: string): string => path.substring(path.lastIndexOf("/") + 1);

const getPathDirName = (path: string): string => {
    const index = path.lastIndexOf("/");
    return index === -1 ? "" : path.substring(0, index);
};

const joinPath = (dir: string, name: string): string => `${dir.replace(/\/$/, "")}/${name}`;

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
    );
};

interface TreeNodeItemProps {
    note: Note;
    depth: number;
    node: TreeNode;
    isFocused: boolean;
    isLoading: boolean;
    isExpanded: boolean;
    isDropTarget: boolean;
    isManuallyExpanded: boolean;
    shouldReduceMotion: boolean | null;
    onHover?: () => void;
    isConfirming: boolean;
    onActivate: () => void;
    onConfirmCancel: () => void;
    onDragStart: (e: React.DragEvent, node: TreeNode) => void;
    onDropMove: (e: React.DragEvent, node: TreeNode) => void;
    onDragOverMove: (e: React.DragEvent, node: TreeNode) => void;
    onConfirmDelete: () => void;
    onConfirmRequest: () => void;
    onDelete?: (node: TreeNode) => void;
    onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
}

type AnimatedFolderIconProps = {
    isExpanded: boolean;
    isManuallyExpanded: boolean;
    shouldReduceMotion: boolean | null;
};

function AnimatedFolderIcon({ isExpanded, isManuallyExpanded, shouldReduceMotion }: AnimatedFolderIconProps) {
    const previousManualExpandedRef = useRef(isManuallyExpanded);
    const shouldAnimate = previousManualExpandedRef.current !== isManuallyExpanded && !shouldReduceMotion;
    const Icon = isExpanded ? FolderOpenIcon : FolderIcon;

    useEffect(() => {
        previousManualExpandedRef.current = isManuallyExpanded;
    }, [isManuallyExpanded]);

    return (
        <Icon className="size-4 shrink-0 text-foreground/70">
            {shouldAnimate && (
                <rect
                    key={isExpanded ? "folder-open-pulse" : "folder-closed-pulse"}
                    x="36"
                    y="72"
                    width="184"
                    height="132"
                    rx="28"
                    fill="currentColor"
                    opacity="0"
                >
                    <animate attributeName="opacity" values="0;0.14;0" dur="0.18s" repeatCount="1" />
                </rect>
            )}
        </Icon>
    );
}

const TreeNodeItem = ({
    node,
    depth,
    isExpanded,
    isFocused,
    isLoading,
    isManuallyExpanded,
    isDropTarget,
    shouldReduceMotion,
    onActivate,
    onDelete,
    onHover,
    onDragStart,
    onDropMove,
    onDragOverMove,
    isConfirming,
    onConfirmRequest,
    onConfirmCancel,
    onConfirmDelete,
    onContextMenu,
    note,
}: TreeNodeItemProps) => {
    const isDirectory = node.type === "directory";
    const extConfig = getFileConfig(node, note);
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isFocused && itemRef.current) {
            itemRef.current.scrollIntoView({ block: "nearest" });
        }
    }, [isFocused]);

    const paddingLeft = 12 + depth * 16;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onConfirmDelete();
    };

    return (
        <div
            ref={itemRef}
            role="treeitem"
            draggable
            onClick={onActivate}
            onMouseEnter={onHover}
            onDragStart={(e) => onDragStart(e, node)}
            onDragOver={(e) => onDragOverMove(e, node)}
            onDrop={(e) => onDropMove(e, node)}
            onContextMenu={onContextMenu ? (e) => onContextMenu(e, node) : undefined}
            style={{ paddingLeft }}
            aria-selected={isFocused}
            tabIndex={isFocused ? 0 : -1}
            aria-expanded={isDirectory ? isExpanded : undefined}
            className={`
        group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors
        ${isDropTarget ? "bg-primary/15 ring-1 ring-primary/40" : isFocused ? "bg-muted" : "hover:bg-muted/60"}
        ${!isDirectory && !extConfig ? "cursor-default opacity-50" : ""}
      `}
        >
            {isDirectory ? (
                <>
                    {isLoading ? (
                        <CircleNotchIcon className="size-4 animate-spin text-muted" />
                    ) : isExpanded ? (
                        <CaretDownIcon className="size-4" />
                    ) : (
                        <CaretRightIcon className="size-4" />
                    )}
                    <AnimatedFolderIcon
                        isExpanded={isExpanded}
                        isManuallyExpanded={isManuallyExpanded}
                        shouldReduceMotion={shouldReduceMotion}
                    />
                </>
            ) : (
                <>
                    <span className="w-4" />
                    {note?.noteType === NoteType.quick ? (
                        <LightningIcon className="size-4 text-warn" />
                    ) : extConfig ? (
                        <extConfig.icon className={extConfig.iconClass} />
                    ) : (
                        <FileIcon className="size-4 text-foreground/50" />
                    )}
                </>
            )}
            <span className={`
          flex-1 truncate text-sm
          ${isFocused ? "font-medium text-foreground" : "text-foreground/70"}
          ${!isDirectory && !extConfig ? "text-foreground/35" : ""}
        `}>{node.name}</span>
            {onDelete && (
                <Tooltip
                    open={isConfirming}
                    hover={false}
                    onChange={(open) => !open && onConfirmCancel()}
                    placement="top-start"
                    title={
                        <button
                            type="button"
                            className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger-subtle focus:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfirmRequest();
                            }}
                            title="Delete"
                        >
                            <TrashIcon className="size-4 text-muted-foreground transition-colors hover:text-danger" />
                        </button>
                    }
                >
                    <div
                        className="flex min-w-[200px] flex-col gap-3 rounded-xl p-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-sm font-medium">Delete this {isDirectory ? "directory" : "file"}?</p>
                        <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <Button size="small" theme="muted" onClick={onConfirmCancel}>
                                Cancel
                            </Button>
                            <Button size="small" onClick={handleDelete}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </Tooltip>
            )}
        </div>
    );
};

const flattenVisibleNodes = (
    nodes: TreeNode[],
    expandedPaths: Set<string>,
    childrenCache: Map<string, TreeNode[]>,
    searchQuery: string,
    depth = 0,
    parentPath: string | null = null,
): FlattenedNode[] => {
    const query = searchQuery.toLowerCase();
    return nodes.flatMap((node) => {
        const children = node.type === "directory" ? childrenCache.get(node.path) || [] : [];
        const matchesSearch = !query || node.name.toLowerCase().includes(query);
        const hasMatchingChild =
            query &&
            node.type === "directory" &&
            (children.some((child) => child.name.toLowerCase().includes(query)) || false);

        const isExpanded = query ? true : expandedPaths.has(node.path);
        if (query && !matchesSearch && !hasMatchingChild) {
            const subResult = flattenVisibleNodes(
                children,
                expandedPaths,
                childrenCache,
                searchQuery,
                depth + 1,
                node.path,
            );
            if (subResult.length === 0) return [];
            return [{ node, depth, isExpanded, parentPath }, ...subResult];
        }
        const result: FlattenedNode[] = [{ node, depth, isExpanded, parentPath }];
        if (node.type === "directory" && isExpanded) {
            result.push(
                ...flattenVisibleNodes(children, expandedPaths, childrenCache, searchQuery, depth + 1, node.path),
            );
        }
        return result;
    });
};

export type TreeCreateRequest = {
    id: number;
    kind: "file" | "directory";
    parentPath?: string | null;
};

interface TreeViewProps {
    rootPath: string;
    searchQuery?: string;
    map: Map<string, Note>;
    createRequest?: TreeCreateRequest | null;
    onFileSelect: (node: TreeNode) => void;
    onDelete?: (node: TreeNode) => Promise<boolean>;
    onNewFile?: (targetPath: string) => Promise<boolean>;
    onNewFolder?: (targetPath: string) => Promise<boolean>;
    onMove?: (sourceNode: TreeNode, targetDirectoryPath: string, destinationPath: string) => Promise<boolean>;
    onFocusChange?: (node: TreeNode | null) => void;
}

export const TreeView = ({
    map,
    onDelete,
    onNewFile,
    onNewFolder,
    onMove,
    rootPath,
    createRequest,
    onFileSelect,
    onFocusChange,
    searchQuery = "",
}: TreeViewProps) => {
    const [rootChildren, setRootChildren] = useState<TreeNode[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isRequestingAccess, setIsRequestingAccess] = useState(false);

    const [expandedPaths, setExpandedPaths] = useState(() => new Set<string>());
    const [childrenCache, setChildrenCache] = useState(new Map<string, TreeNode[]>());
    const [loadingPaths, setLoadingPaths] = useState(new Set<string>());
    const [confirmingPath, setConfirmingPath] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [draggedPath, setDraggedPath] = useState<string | null>(null);
    const draggedPathRef = useRef<string | null>(null);
    const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [pendingCreate, setPendingCreate] = useState<{
        parentPath: string | null;
        kind: "file" | "directory";
        depth: number;
    } | null>(null);
    const [pendingName, setPendingName] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const pendingInputRef = useRef<HTMLInputElement>(null);
    const pendingCommitRef = useRef(false);
    const hasRequestedDirectoryAccessRef = useRef(false);
    const childrenCacheRef = useRef(new Map<string, TreeNode[]>());
    const expandedPathsRef = useRef(new Set<string>());
    const flattenedNodesRef = useRef<FlattenedNode[]>([]);
    const shouldReduceMotion = useReducedMotion();

    const loadRoot = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.fs.readDir(rootPath);
            if (result.error) {
                setError(result.error);
                setPermissionDenied(result.errorCode === "EPERM" || result.errorCode === "EACCES");
            } else {
                setPermissionDenied(false);
                setRootChildren(result.entries);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load directory");
        } finally {
            setIsLoading(false);
        }
    }, [rootPath]);

    const requestDirectoryAccess = useCallback(async () => {
        setIsRequestingAccess(true);
        try {
            const result = await window.electronAPI.fs.requestDirectoryAccess(rootPath);
            if (result.granted) {
                await loadRoot();
                return;
            }
            setError(result.error ?? "Folder access was not granted");
        } catch (accessError) {
            setError(accessError instanceof Error ? accessError.message : "Failed to request folder access");
        } finally {
            setIsRequestingAccess(false);
        }
    }, [loadRoot, rootPath]);

    useEffect(() => {
        loadRoot();
    }, [loadRoot]);

    useEffect(() => {
        if (!permissionDenied || hasRequestedDirectoryAccessRef.current) return;
        hasRequestedDirectoryAccessRef.current = true;
        void requestDirectoryAccess();
    }, [permissionDenied, requestDirectoryAccess]);

    useEffect(() => {
        if (!isElectron()) return;
        return window.electronAPI.fs.onDirChanged(({ dirPath }) => {
            if (dirPath === rootPath) {
                loadRoot();
            } else if (childrenCacheRef.current.has(dirPath)) {
                window.electronAPI.fs.readDir(dirPath).then((result) => {
                    setChildrenCache((prev) => new Map(prev).set(dirPath, result.entries || []));
                });
            }
        });
    }, [rootPath, loadRoot]);

    const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
        if (!isElectron()) return;
        e.preventDefault();
        e.stopPropagation();
        window.electronAPI.contextMenu.showExplorer(node.path, node.type === "directory");
    }, []);

    const handleRootContextMenu = useCallback(
        (e: React.MouseEvent) => {
            if (!isElectron()) return;
            e.preventDefault();
            e.stopPropagation();
            window.electronAPI.contextMenu.showExplorer(rootPath, true);
        },
        [rootPath],
    );

    const handleRenameConfirm = useCallback(
        async (newName: string) => {
            if (!renamingPath || !newName.trim()) {
                setRenamingPath(null);
                return;
            }
            const dir = renamingPath.substring(0, renamingPath.lastIndexOf("/"));
            const newPath = dir + "/" + newName.trim();
            await window.electronAPI.fs.moveFile(renamingPath, newPath);
            setRenamingPath(null);
            loadRoot();
        },
        [renamingPath, loadRoot],
    );

    const flattenedNodes = useMemo(() => {
        if (!rootChildren) return [];
        return flattenVisibleNodes(rootChildren, expandedPaths, childrenCache, searchQuery);
    }, [rootChildren, expandedPaths, childrenCache, searchQuery]);

    useEffect(() => {
        childrenCacheRef.current = childrenCache;
    }, [childrenCache]);
    useEffect(() => {
        expandedPathsRef.current = expandedPaths;
    }, [expandedPaths]);
    useEffect(() => {
        flattenedNodesRef.current = flattenedNodes;
    }, [flattenedNodes]);

    const insertionIndex = useMemo(() => {
        if (!pendingCreate) return -1;
        if (pendingCreate.parentPath === null) return flattenedNodes.length;
        const parentIdx = flattenedNodes.findIndex((n) => n.node.path === pendingCreate.parentPath);
        if (parentIdx === -1) return flattenedNodes.length;
        let lastChildIdx = parentIdx;
        const parentDepth = flattenedNodes[parentIdx]!.depth;
        for (let i = parentIdx + 1; i < flattenedNodes.length && (flattenedNodes[i]?.depth ?? 0) > parentDepth; i++) {
            lastChildIdx = i;
        }
        return lastChildIdx + 1;
    }, [pendingCreate, flattenedNodes]);

    const pendingCreateDepth = useMemo(() => {
        if (!pendingCreate) return 0;
        if (pendingCreate.parentPath === rootPath || pendingCreate.parentPath === null) {
            return pendingCreate.depth;
        }

        const parent = flattenedNodes.find((n) => n.node.path === pendingCreate.parentPath);
        return parent ? parent.depth + 1 : pendingCreate.depth;
    }, [pendingCreate, flattenedNodes, rootPath]);

    const refreshDirectory = useCallback(
        async (path: string) => {
            if (path === rootPath) {
                await loadRoot();
                return;
            }

            const result = await window.electronAPI.fs.readDir(path);
            setChildrenCache((prev) => new Map(prev).set(path, result.entries || []));
        },
        [loadRoot, rootPath],
    );

    const handlePendingCommit = useCallback(async () => {
        if (pendingCommitRef.current) return;
        if (!pendingCreate || !pendingName.trim()) {
            setPendingCreate(null);
            setPendingName("");
            return;
        }
        pendingCommitRef.current = true;
        const rawName = pendingName.trim();
        const fileName = pendingCreate.kind === "file" ? (rawName.includes(".") ? rawName : rawName + ".md") : rawName;
        const parentPath = pendingCreate.parentPath ?? rootPath;
        const targetPath = parentPath + "/" + fileName;
        try {
            const success =
                pendingCreate.kind === "file" ? await onNewFile?.(targetPath) : await onNewFolder?.(targetPath);
            if (success) {
                await refreshDirectory(parentPath);
                setPendingCreate(null);
                setPendingName("");
            }
        } finally {
            pendingCommitRef.current = false;
        }
    }, [pendingCreate, pendingName, rootPath, onNewFile, onNewFolder, refreshDirectory]);

    useEffect(() => {
        if (flattenedNodes.length > 0 && focusedIndex >= flattenedNodes.length) {
            setFocusedIndex(flattenedNodes.length - 1);
        }
    }, [flattenedNodes.length, focusedIndex]);

    useEffect(() => {
        if (onFocusChange) {
            onFocusChange(flattenedNodes[focusedIndex]?.node || null);
        }
    }, [flattenedNodes, focusedIndex, onFocusChange]);

    useEffect(() => {
        setPendingCreate(null);
        setPendingName("");
    }, [rootPath]);

    useEffect(() => {
        if (pendingCreate !== null) {
            pendingInputRef.current?.focus();
        }
    }, [pendingCreate]);

    const loadChildren = useCallback(async (path: string): Promise<TreeNode[]> => {
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
            const result = await window.electronAPI.fs.readDir(path);
            const children = result.entries || [];
            setChildrenCache((prev) => new Map(prev).set(path, children));
            return children;
        } catch (error) {
            console.error("Failed to load directory:", error);
            setChildrenCache((prev) => new Map(prev).set(path, []));
            return [];
        } finally {
            setLoadingPaths((prev) => {
                const next = new Set(prev);
                next.delete(path);
                return next;
            });
        }
    }, []);

    const expandNode = useCallback(
        async (path: string) => {
            if (!childrenCacheRef.current.has(path)) {
                await loadChildren(path);
            }
            setExpandedPaths((prev) => new Set(prev).add(path));
        },
        [loadChildren],
    );

    const startPendingCreate = useCallback(
        (kind: TreeCreateRequest["kind"], filePath: string, isDirectory: boolean, flatNode?: FlattenedNode) => {
            if (filePath === rootPath) {
                setPendingCreate({ parentPath: rootPath, kind, depth: 0 });
                setPendingName("");
                return;
            }

            if (isDirectory) {
                const depth = (flatNode?.depth ?? 0) + 1;
                expandNode(filePath).then(() => {
                    setPendingCreate({ parentPath: filePath, kind, depth });
                    setPendingName("");
                });
                return;
            }

            const parentPath = filePath.substring(0, filePath.lastIndexOf("/"));
            const depth = flatNode?.depth ?? 0;
            setPendingCreate({ parentPath, kind, depth });
            setPendingName("");
        },
        [expandNode, rootPath],
    );

    useEffect(() => {
        if (!createRequest) return;
        startPendingCreate(createRequest.kind, createRequest.parentPath ?? rootPath, true);
    }, [createRequest, rootPath, startPendingCreate]);

    useEffect(() => {
        if (!isElectron()) return;
        return window.electronAPI.onContextMenuAction(({ action, filePath, isDirectory }) => {
            if (action === "copy-relative-path") {
                const rel = filePath.startsWith(rootPath + "/") ? filePath.slice(rootPath.length + 1) : filePath;
                navigator.clipboard.writeText(rel);
                return;
            }

            const flatNode = flattenedNodesRef.current.find((n) => n.node.path === filePath);
            const isRoot = filePath === rootPath;
            if (!flatNode && !isRoot) return;

            if (action === "delete") {
                if (!flatNode) return;
                setConfirmingPath(filePath);
            } else if (action === "rename") {
                if (!flatNode) return;
                setRenamingPath(filePath);
            } else if (action === "new-file" || action === "new-folder") {
                const kind = action === "new-file" ? "file" : "directory";
                startPendingCreate(kind, filePath, Boolean(isDirectory), flatNode);
            }
        });
    }, [rootPath, startPendingCreate]);

    const collapseNode = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
        });
    }, []);

    const toggleNode = useCallback(
        async (path: string) => {
            if (expandedPathsRef.current.has(path)) {
                collapseNode(path);
            } else {
                await expandNode(path);
            }
        },
        [expandNode, collapseNode],
    );

    const activateNode = useCallback(
        async (flatNode: FlattenedNode) => {
            const { node } = flatNode;
            if (node.type === "directory") {
                await toggleNode(node.path);
            } else if (getFileConfig(node, null)?.selectable) {
                onFileSelect(node);
            }
        },
        [toggleNode, onFileSelect],
    );

    const findNodeByPath = useCallback((path: string): TreeNode | null => {
        for (const flatNode of flattenedNodesRef.current) {
            if (flatNode.node.path === path) return flatNode.node;
        }
        return null;
    }, []);

    const getMoveTargetDirectory = useCallback(
        (targetNode: TreeNode | null): string => {
            if (!targetNode) return rootPath;
            return targetNode.type === "directory" ? targetNode.path : getPathDirName(targetNode.path);
        },
        [rootPath],
    );

    const canMoveNode = useCallback((sourceNode: TreeNode, targetDirectoryPath: string): boolean => {
        if (sourceNode.path === targetDirectoryPath) return false;
        const sourceParent = getPathDirName(sourceNode.path);
        if (sourceParent === targetDirectoryPath) return false;
        if (sourceNode.type === "directory" && targetDirectoryPath.startsWith(sourceNode.path + "/")) {
            return false;
        }
        return true;
    }, []);

    const moveNodeToTarget = useCallback(
        async (sourceNode: TreeNode, targetNode: TreeNode | null) => {
            const targetDirectoryPath = getMoveTargetDirectory(targetNode);
            if (!canMoveNode(sourceNode, targetDirectoryPath)) return;

            const destinationPath = joinPath(targetDirectoryPath, getPathBaseName(sourceNode.path));
            const existing = await window.electronAPI.fs.statFile(destinationPath);
            if (!existing.success) {
                setError(existing.error ?? "Failed to check destination");
                return;
            }
            if (existing.exists) {
                setError("A file or folder already exists at the drop target.");
                return;
            }

            const success = onMove
                ? await onMove(sourceNode, targetDirectoryPath, destinationPath)
                : Boolean((await window.electronAPI.fs.moveFile(sourceNode.path, destinationPath))?.success);
            if (!success) return;

            await refreshDirectory(getPathDirName(sourceNode.path) || rootPath);
            await refreshDirectory(targetDirectoryPath);
            if (sourceNode.type === "directory") {
                setChildrenCache((prev) => {
                    const next = new Map(prev);
                    next.delete(sourceNode.path);
                    return next;
                });
            }
        },
        [canMoveNode, getMoveTargetDirectory, onMove, refreshDirectory, rootPath],
    );

    const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
        draggedPathRef.current = node.path;
        setDraggedPath(node.path);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(TREE_NODE_DRAG_TYPE, node.path);
        e.dataTransfer.setData("text/plain", node.path);
    }, []);

    const handleDragOverMove = useCallback(
        (e: React.DragEvent, targetNode: TreeNode | null) => {
            const sourcePath = draggedPathRef.current || draggedPath || e.dataTransfer.getData(TREE_NODE_DRAG_TYPE);
            if (!sourcePath) return;
            const sourceNode = findNodeByPath(sourcePath);
            if (!sourceNode) return;
            const targetDirectoryPath = getMoveTargetDirectory(targetNode);
            if (!canMoveNode(sourceNode, targetDirectoryPath)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDropTargetPath(targetNode?.path ?? rootPath);
        },
        [canMoveNode, draggedPath, findNodeByPath, getMoveTargetDirectory, rootPath],
    );

    const handleDropMove = useCallback(
        async (e: React.DragEvent, targetNode: TreeNode | null) => {
            const sourcePath = e.dataTransfer.getData(TREE_NODE_DRAG_TYPE);
            if (!sourcePath) return;
            e.preventDefault();
            e.stopPropagation();
            draggedPathRef.current = null;
            setDropTargetPath(null);
            setDraggedPath(null);
            const sourceNode = findNodeByPath(sourcePath);
            if (!sourceNode) return;
            await moveNodeToTarget(sourceNode, targetNode);
        },
        [findNodeByPath, moveNodeToTarget],
    );

    const handleDragEnd = useCallback(() => {
        draggedPathRef.current = null;
        setDraggedPath(null);
        setDropTargetPath(null);
    }, []);

    const handleNodeDelete = useCallback(
        async (node: TreeNode) => {
            if (!onDelete) return;

            const success = await onDelete(node);
            if (success) {
                setConfirmingPath(null);
                // Refresh logic
                // Check if node is in root
                if (rootChildren?.some((n) => n.path === node.path)) {
                    loadRoot();
                    return;
                }

                // Check cache for parent
                for (const [parentPath, children] of childrenCacheRef.current.entries()) {
                    if (children.some((n) => n.path === node.path)) {
                        // Reload this parent
                        // We need to bypass cache check in loadChildren.
                        // Simplest: clear cache entry then load.
                        setChildrenCache((prev) => {
                            const next = new Map(prev);
                            next.delete(parentPath);
                            return next;
                        });
                        // We can't call loadChildren immediately because state update is async
                        // and loadChildren checks current state cache.
                        // However, setState accepts a callback or we can pass a 'force' arg if we modify loadChildren.

                        // Better: Direct call to API and update state.
                        window.electronAPI.fs.readDir(parentPath).then((result) => {
                            const newChildren = result.entries || [];
                            setChildrenCache((prev) => new Map(prev).set(parentPath, newChildren));
                        });
                        return;
                    }
                }
            }
        },
        [onDelete, rootChildren, loadRoot],
    );

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (isEditableTarget(e.target)) return;

            const nodes = flattenedNodesRef.current;
            if (nodes.length === 0) return;

            const currentNode = nodes[focusedIndex];
            if (!currentNode) return;

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setFocusedIndex((prev) => Math.min(prev + 1, nodes.length - 1));
                    break;

                case "ArrowUp":
                    e.preventDefault();
                    setFocusedIndex((prev) => Math.max(prev - 1, 0));
                    break;

                case "ArrowRight":
                    e.preventDefault();
                    if (currentNode.node.type === "directory") {
                        if (!currentNode.isExpanded) {
                            await expandNode(currentNode.node.path);
                        } else {
                            const children = childrenCacheRef.current.get(currentNode.node.path) || [];
                            if (children.length > 0) {
                                setFocusedIndex((prev) => prev + 1);
                            }
                        }
                    }
                    break;

                case "ArrowLeft":
                    e.preventDefault();
                    if (currentNode.node.type === "directory" && currentNode.isExpanded) {
                        collapseNode(currentNode.node.path);
                    } else if (currentNode.parentPath) {
                        const parentIndex = nodes.findIndex((n) => n.node.path === currentNode.parentPath);
                        if (parentIndex !== -1) {
                            setFocusedIndex(parentIndex);
                        }
                    }
                    break;

                case "Enter":
                case " ":
                    e.preventDefault();
                    await activateNode(currentNode);
                    break;

                case "Delete":
                case "Backspace":
                    if (onDelete) {
                        e.preventDefault();
                        setConfirmingPath(currentNode.node.path);
                    }
                    break;

                case "Escape":
                    if (confirmingPath) {
                        e.preventDefault();
                        setConfirmingPath(null);
                    }
                    break;

                case "n":
                case "N":
                case "m":
                case "M":
                    // Let the parent handle these shortcuts
                    break;

                default:
                    return; // Don't stop propagation for other keys
            }
            e.stopPropagation();
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener("keydown", handleKeyDown);
            return () => container.removeEventListener("keydown", handleKeyDown);
        }
        return undefined;
    }, [focusedIndex, expandNode, collapseNode, activateNode, onDelete, handleNodeDelete, confirmingPath]);

    // Focus container on mount
    useEffect(() => {
        if (rootChildren && rootChildren.length > 0) {
            containerRef.current?.focus();
        }
    }, [rootChildren]);

    if (isLoading && !rootChildren) {
        return (
            <div className="flex items-center justify-center p-8">
                <SpinnerIcon className="h-6 w-6 animate-spin text-info" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-danger">
                <p>Error loading directory:</p>
                <p className="mt-1 text-sm">{error}</p>
                {permissionDenied && (
                    <div className="mt-4">
                        <Button size="small" disabled={isRequestingAccess} onClick={requestDirectoryAccess}>
                            {isRequestingAccess ? "Checking access…" : "Grant access and retry"}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    if ((!rootChildren || rootChildren.length === 0) && pendingCreate === null) {
        return <div className="p-8 text-center text-muted-foreground">No files found in this directory</div>;
    }

    return (
        <div
            ref={containerRef}
            role="tree"
            className={`py-2 outline-none focus-visible:!ring-0 focus-visible:!outline-none ${dropTargetPath === rootPath ? "bg-primary/10" : ""}`}
            tabIndex={0}
            onDragOver={(e) => handleDragOverMove(e, null)}
            onDrop={(e) => handleDropMove(e, null)}
            onDragEnd={handleDragEnd}
            onContextMenu={isElectron() ? handleRootContextMenu : undefined}
        >
            {flattenedNodes.slice(0, insertionIndex === -1 ? undefined : insertionIndex).map((flatNode, index) => (
                <TreeNodeItem
                    node={flatNode.node}
                    depth={flatNode.depth}
                    key={flatNode.node.path}
                    isExpanded={flatNode.isExpanded}
                    isFocused={index === focusedIndex}
                    isDropTarget={dropTargetPath === flatNode.node.path}
                    isManuallyExpanded={expandedPaths.has(flatNode.node.path)}
                    shouldReduceMotion={shouldReduceMotion}
                    note={map.get(flatNode.node.path)!}
                    onHover={() => setFocusedIndex(index)}
                    onDragStart={handleDragStart}
                    onDropMove={handleDropMove}
                    onDragOverMove={handleDragOverMove}
                    onConfirmCancel={() => setConfirmingPath(null)}
                    isLoading={loadingPaths.has(flatNode.node.path)}
                    onDelete={onDelete ? handleNodeDelete : undefined}
                    isConfirming={confirmingPath === flatNode.node.path}
                    onConfirmDelete={() => handleNodeDelete(flatNode.node)}
                    onConfirmRequest={() => setConfirmingPath(flatNode.node.path)}
                    onContextMenu={isElectron() ? handleContextMenu : undefined}
                    onActivate={() => {
                        setFocusedIndex(index);
                        activateNode(flatNode);
                    }}
                />
            ))}
            {pendingCreate !== null && (
                <div
                    role="none"
                    className="flex items-center gap-2 px-2 py-1.5"
                    style={{ paddingLeft: 12 + pendingCreateDepth * 16 }}
                >
                    <span className="w-4 shrink-0" />
                    {pendingCreate.kind === "directory" ? (
                        <FolderIcon className="size-4 shrink-0 text-foreground/70" />
                    ) : (
                        <FileTextIcon className="size-4 shrink-0 text-foreground/70" />
                    )}
                    <input
                        ref={pendingInputRef}
                        className="flex-1 border-b border-border bg-transparent text-sm text-foreground outline-none"
                        value={pendingName}
                        onChange={(e) => setPendingName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                void handlePendingCommit();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setPendingCreate(null);
                                setPendingName("");
                            }
                        }}
                        onBlur={() => void handlePendingCommit()}
                    />
                </div>
            )}
            {insertionIndex !== -1 &&
                flattenedNodes.slice(insertionIndex).map((flatNode, i) => {
                    const index = insertionIndex + i;
                    return (
                        <TreeNodeItem
                            node={flatNode.node}
                            depth={flatNode.depth}
                            key={flatNode.node.path}
                            isExpanded={flatNode.isExpanded}
                            isFocused={index === focusedIndex}
                            isDropTarget={dropTargetPath === flatNode.node.path}
                            isManuallyExpanded={expandedPaths.has(flatNode.node.path)}
                            shouldReduceMotion={shouldReduceMotion}
                            note={map.get(flatNode.node.path)!}
                            onHover={() => setFocusedIndex(index)}
                            onDragStart={handleDragStart}
                            onDropMove={handleDropMove}
                            onDragOverMove={handleDragOverMove}
                            onConfirmCancel={() => setConfirmingPath(null)}
                            isLoading={loadingPaths.has(flatNode.node.path)}
                            onDelete={onDelete ? handleNodeDelete : undefined}
                            isConfirming={confirmingPath === flatNode.node.path}
                            onConfirmDelete={() => handleNodeDelete(flatNode.node)}
                            onConfirmRequest={() => setConfirmingPath(flatNode.node.path)}
                            onContextMenu={isElectron() ? handleContextMenu : undefined}
                            onActivate={() => {
                                setFocusedIndex(index);
                                activateNode(flatNode);
                            }}
                        />
                    );
                })}
            {renamingPath && (
                <Prompt
                    open
                    title="Rename"
                    placeholder="New name"
                    initialValue={renamingPath.substring(renamingPath.lastIndexOf("/") + 1)}
                    onConfirm={handleRenameConfirm}
                    onCancel={() => setRenamingPath(null)}
                />
            )}
        </div>
    );
};
