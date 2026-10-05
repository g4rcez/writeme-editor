import type React from "react";
import { Tooltip, Button, css } from "@g4rcez/components";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useRef } from "react";
import type { TreeNode } from "@/types/tree";
import { NoteType, type Note } from "@/store/note";
import { getFileConfig } from "./tree-view-utils";

type TreeNodeItemProps = {
    note: Note | null;
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
};

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

export const TreeNodeItem = ({
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
            draggable
            ref={itemRef}
            role="treeitem"
            onClick={onActivate}
            onMouseEnter={onHover}
            style={{ paddingLeft }}
            aria-selected={isFocused}
            tabIndex={isFocused ? 0 : -1}
            onDrop={(e) => onDropMove(e, node)}
            onDragStart={(e) => onDragStart(e, node)}
            onDragOver={(e) => onDragOverMove(e, node)}
            aria-expanded={isDirectory ? isExpanded : undefined}
            onContextMenu={onContextMenu ? (e) => onContextMenu(e, node) : undefined}
            className={css(
                "group flex cursor-pointer items-center gap-2 rounded-card-radius px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDropTarget
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : isFocused
                      ? "bg-primary/10"
                      : "hover:bg-muted/60",
                !isDirectory && !extConfig ? "cursor-default opacity-50" : "",
            )}
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
        `} title={node.relativePath ?? node.name}>
                {node.relativePath ?? node.name}
            </span>
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
