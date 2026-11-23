export interface TreeNode {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: Array<TreeNode>; // undefined = not loaded yet, [] = empty
    extension?: string;
    relativePath?: string;
}

export interface ReadDirResult {
    entries: Array<TreeNode>;
    error?: string;
    errorCode?: string;
}

export const DEFAULT_RECURSIVE_DIRECTORY_DEPTH = 3;
export const FILE_SEARCH_RESULT_LIMIT = 2000;

export type FileSearchEntry = {
    name: string;
    path: string;
    relativePath: string;
    type: "file" | "directory";
    extension?: string;
};

export type FileSearchEvent =
    | { requestId: string; type: "batch"; entries: Array<FileSearchEntry> }
    | { requestId: string; type: "complete"; truncated: boolean }
    | { requestId: string; type: "error"; error: string };

export type FileSearchStartResult = { success: true } | { success: false; error: string };

export type DirectoryAccessResult = {
    granted: boolean;
    error?: string;
};

export interface FlattenedNode {
    node: TreeNode;
    depth: number;
    isExpanded: boolean;
    parentPath: string | null;
}
