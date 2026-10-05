import { Button } from "@g4rcez/components";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { SpinnerIcon } from "@phosphor-icons/react/dist/csr/Spinner";
import { useReducedMotion } from "motion/react";
import { Prompt } from "@/app/components/prompt";
import { isElectron } from "@/lib/is-electron";
import { FILE_SEARCH_RESULT_LIMIT, type FlattenedNode } from "@/types/tree";
import type { TreeViewProps } from "./tree-view/types";
import { TreeNodeItem } from "./tree-view/tree-node-item";
import { useTreeViewActions } from "./tree-view/use-tree-view-actions";
import { useTreeViewData } from "./tree-view/use-tree-view-data";

export type { TreeCreateRequest } from "./tree-view/types";

export const TreeView = (props: TreeViewProps) => {
    const { map, rootPath, searchQuery = "" } = props;
    const data = useTreeViewData(rootPath, searchQuery);
    const {
        rootChildren,
        isLoading,
        error,
        permissionDenied,
        isRequestingAccess,
        requestDirectoryAccess,
        expandedPaths,
        loadingPaths,
        isSearching,
        searchResults,
        searchStatus,
        searchError,
        searchTruncated,
        flattenedNodes,
    } = data;
    const {
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
    } = useTreeViewActions(props, data);
    const shouldReduceMotion = useReducedMotion();

    const renderTreeNode = (flatNode: FlattenedNode, index: number) => (
        <TreeNodeItem
            node={flatNode.node}
            depth={flatNode.depth}
            key={flatNode.node.path}
            isExpanded={flatNode.isExpanded}
            isFocused={index === focusedIndex}
            isDropTarget={dropTargetPath === flatNode.node.path}
            isManuallyExpanded={expandedPaths.has(flatNode.node.path)}
            shouldReduceMotion={shouldReduceMotion}
            note={map.get(flatNode.node.path) ?? null}
            onHover={() => setFocusedIndex(index)}
            onDragStart={handleDragStart}
            onDropMove={handleDropMove}
            onDragOverMove={handleDragOverMove}
            onConfirmCancel={() => setConfirmingPath(null)}
            isLoading={loadingPaths.has(flatNode.node.path)}
            onDelete={props.onDelete ? handleNodeDelete : undefined}
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

    if (isLoading && !rootChildren && !isSearching) {
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

    if (isSearching && searchStatus === "error") {
        return <div className="p-8 text-center text-danger">{searchError ?? "Failed to search workspace files"}</div>;
    }

    if (isSearching && searchResults.length === 0 && searchStatus !== "complete") {
        return (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground" role="status">
                <SpinnerIcon className="size-4 animate-spin" />
                <span>Searching files…</span>
            </div>
        );
    }

    if (isSearching && searchStatus === "complete" && searchResults.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No matching files</div>;
    }

    if (!isSearching && (!rootChildren || rootChildren.length === 0) && pendingCreate === null) {
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
            {flattenedNodes.slice(0, insertionIndex === -1 ? undefined : insertionIndex).map(renderTreeNode)}
            {isSearching && searchTruncated && (
                <p className="px-4 py-2 text-center text-xs text-muted-foreground" role="status">
                    Showing the first {FILE_SEARCH_RESULT_LIMIT.toLocaleString()} matching files.
                </p>
            )}
            {pendingCreate !== null && (
                <div
                    role="none"
                    className="flex items-center gap-2 px-2"
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
                flattenedNodes
                    .slice(insertionIndex)
                    .map((flatNode, index) => renderTreeNode(flatNode, insertionIndex + index))}
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
