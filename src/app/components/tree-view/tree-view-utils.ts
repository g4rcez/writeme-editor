import type { ElementType } from "react";
import { BracketsCurlyIcon, PencilRulerIcon } from "@phosphor-icons/react";
import { BookmarkIcon } from "@phosphor-icons/react/dist/csr/Bookmark";
import { FilePdfIcon } from "@phosphor-icons/react/dist/csr/FilePdf";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FilmStripIcon } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { NoteType, type Note } from "@/store/note";
import { type FlattenedNode, type TreeNode } from "@/types/tree";

export type FileExtensionConfig = {
    icon: ElementType;
    iconClass: string;
    selectable: boolean;
};

const FILE_EXTENSION_CONFIGS: Record<string, FileExtensionConfig> = {
    ".md": {
        icon: FileTextIcon,
        iconClass: "text-foreground/70 size-4",
        selectable: true,
    },
    ".mdx": {
        icon: FileTextIcon,
        iconClass: "text-foreground/70 size-4",
        selectable: true,
    },
    ".tex": {
        icon: FileTextIcon,
        iconClass: "text-foreground/70 size-4",
        selectable: true,
    },
    ".latex": {
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

export const getFileConfig = (node: TreeNode, note: Note | null): FileExtensionConfig | undefined => {
    if (note?.noteType === NoteType.excalidraw) {
        return FILE_NAME_CONFIGS.excalidraw;
    }
    return FILE_NAME_CONFIGS[node.name.toLowerCase()] ?? FILE_EXTENSION_CONFIGS[node.extension?.toLowerCase() ?? ""];
};

export const TREE_NODE_DRAG_TYPE = "application/x-writeme-tree-node-path";

export const getPathBaseName = (path: string): string => path.substring(path.lastIndexOf("/") + 1);

export const getPathDirName = (path: string): string => {
    const index = path.lastIndexOf("/");
    return index === -1 ? "" : path.substring(0, index);
};

export const joinPath = (dir: string, name: string): string => `${dir.replace(/\/$/, "")}/${name}`;

export const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
    );
};

export const flattenVisibleNodes = (
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

export type FileSearchStatus = "idle" | "loading" | "complete" | "error";

let nextFileSearchRequestId = 0;

export const createFileSearchRequestId = (): string => {
    nextFileSearchRequestId += 1;
    return `file-search-${Date.now()}-${nextFileSearchRequestId}`;
};
