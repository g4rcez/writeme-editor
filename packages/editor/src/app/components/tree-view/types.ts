import type { Note } from "@/store/note";
import type { TreeNode } from "@/types/tree";

export type TreeCreateRequest = {
    id: number;
    kind: "file" | "directory";
    parentPath?: string | null;
};

export type TreeViewProps = {
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
};
