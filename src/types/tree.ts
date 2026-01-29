export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[]; // undefined = not loaded yet, [] = empty
  extension?: string;
}

export interface ReadDirResult {
  entries: TreeNode[];
  error?: string;
}

export interface FlattenedNode {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  parentPath: string | null;
}
