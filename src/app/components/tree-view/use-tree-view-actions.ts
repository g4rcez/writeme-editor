import type { DragEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlattenedNode, TreeNode } from "@/types/tree";
import { isElectron } from "@/lib/is-electron";
import type { TreeViewProps } from "./types";
import type { TreeViewData } from "./use-tree-view-data";
import {
    getFileConfig,
    getPathBaseName,
    getPathDirName,
    isEditableTarget,
    joinPath,
    TREE_NODE_DRAG_TYPE,
} from "./tree-view-utils";

type PendingCreate = {
    parentPath: string | null;
    kind: "file" | "directory";
    depth: number;
};

export const useTreeViewActions = (props: TreeViewProps, data: TreeViewData) => {
    const { rootPath, createRequest, onDelete, onNewFile, onNewFolder, onMove, onFileSelect, onFocusChange } = props;
    const {
        rootChildren,
        setError,
        setChildrenCache,
        childrenCacheRef,
        flattenedNodes,
        flattenedNodesRef,
        loadRoot,
        refreshDirectory,
        expandNode,
        collapseNode,
        toggleNode,
    } = data;
    const [confirmingPath, setConfirmingPath] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [draggedPath, setDraggedPath] = useState<string | null>(null);
    const draggedPathRef = useRef<string | null>(null);
    const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
    const [pendingName, setPendingName] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const pendingInputRef = useRef<HTMLInputElement>(null);
    const pendingCommitRef = useRef(false);

    const handleContextMenu = useCallback((e: MouseEvent, node: TreeNode) => {
        if (!isElectron()) return;
        e.preventDefault();
        e.stopPropagation();
        window.electronAPI.contextMenu.showExplorer(node.path, node.type === "directory");
    }, []);

    const handleRootContextMenu = useCallback(
        (e: MouseEvent) => {
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

    const startPendingCreate = useCallback(
        (kind: "file" | "directory", filePath: string, isDirectory: boolean, flatNode?: FlattenedNode) => {
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
    }, [flattenedNodesRef, rootPath, startPendingCreate]);

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

    const findNodeByPath = useCallback(
        (path: string): TreeNode | null => {
            for (const flatNode of flattenedNodesRef.current) {
                if (flatNode.node.path === path) return flatNode.node;
            }
            return null;
        },
        [flattenedNodesRef],
    );

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
        [canMoveNode, getMoveTargetDirectory, onMove, refreshDirectory, rootPath, setChildrenCache, setError],
    );

    const handleDragStart = useCallback((e: DragEvent, node: TreeNode) => {
        draggedPathRef.current = node.path;
        setDraggedPath(node.path);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(TREE_NODE_DRAG_TYPE, node.path);
        e.dataTransfer.setData("text/plain", node.path);
    }, []);

    const handleDragOverMove = useCallback(
        (e: DragEvent, targetNode: TreeNode | null) => {
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
        async (e: DragEvent, targetNode: TreeNode | null) => {
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
                if (rootChildren?.some((n) => n.path === node.path)) {
                    loadRoot();
                    return;
                }

                for (const [parentPath, children] of childrenCacheRef.current.entries()) {
                    if (children.some((n) => n.path === node.path)) {
                        setChildrenCache((prev) => {
                            const next = new Map(prev);
                            next.delete(parentPath);
                            return next;
                        });
                        window.electronAPI.fs.readDir(parentPath).then((result) => {
                            const newChildren = result.entries || [];
                            setChildrenCache((prev) => new Map(prev).set(parentPath, newChildren));
                        });
                        return;
                    }
                }
            }
        },
        [childrenCacheRef, loadRoot, onDelete, rootChildren, setChildrenCache],
    );

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
                    break;

                default:
                    return;
            }
            e.stopPropagation();
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener("keydown", handleKeyDown);
            return () => container.removeEventListener("keydown", handleKeyDown);
        }
        return undefined;
    }, [
        focusedIndex,
        expandNode,
        collapseNode,
        activateNode,
        onDelete,
        handleNodeDelete,
        confirmingPath,
        flattenedNodesRef,
        childrenCacheRef,
    ]);

    useEffect(() => {
        if (rootChildren && rootChildren.length > 0) {
            containerRef.current?.focus();
        }
    }, [rootChildren]);

    return {
        confirmingPath,
        focusedIndex,
        setFocusedIndex,
        dropTargetPath,
        pendingCreate,
        pendingName,
        setPendingName,
        pendingInputRef,
        containerRef,
        pendingCreateDepth,
        insertionIndex,
        handleContextMenu,
        handleRootContextMenu,
        handleRenameConfirm,
        handlePendingCommit,
        handleDragStart,
        handleDragOverMove,
        handleDropMove,
        handleDragEnd,
        handleNodeDelete,
        activateNode,
        renamingPath,
        setConfirmingPath,
        setPendingCreate,
        setRenamingPath,
    };
};
