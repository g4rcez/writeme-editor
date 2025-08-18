import type { Editor } from "@tiptap/react";

/**
 * Information about the current element where the cursor is positioned
 */
export type CurrentElementInfo = {
  /** The name of the current node type (e.g., 'paragraph', 'codeBlock', 'heading') */
  nodeName: string;
  /** The depth of the current node in the document tree */
  depth: number;
  /** Whether the selection spans multiple nodes */
  isSelection: boolean;
  /** Additional node attributes if available */
  attrs?: Record<string, unknown>;
  /** Parent node name if available */
  parentName?: string;
};

/**
 * Gets the name and information about the current element where the cursor is positioned
 * in a TipTap editor.
 * 
 * @param editor - The TipTap editor instance
 * @returns Information about the current element
 * 
 * @example
 * ```typescript
 * const elementInfo = getCurrentElementInfo(editor);
 * console.log(elementInfo.nodeName); // 'paragraph' | 'codeBlock' | 'heading' | etc.
 * console.log(elementInfo.isSelection); // true if text is selected
 * ```
 */
export function getCurrentElementInfo(editor: Editor | null): CurrentElementInfo | null {
  if (!editor) {
    return null;
  }

  const { state } = editor;
  const { selection } = state;
  const { $from, empty } = selection;

  // Get the current node at cursor position
  const currentNode = $from.parent;
  const currentNodeName = currentNode.type.name;

  // Get parent node if available
  const parentNode = $from.depth > 1 ? $from.node($from.depth - 1) : null;
  const parentName = parentNode?.type.name;

  // Check if this is a selection spanning multiple nodes
  const isSelection = !empty;

  // Get node attributes
  const attrs = currentNode.attrs || {};

  return {
    nodeName: currentNodeName,
    depth: $from.depth,
    isSelection,
    attrs,
    parentName,
  };
}

/**
 * Gets just the name of the current element where the cursor is positioned.
 * This is a simplified version of getCurrentElementInfo for when you only need the node name.
 * 
 * @param editor - The TipTap editor instance
 * @returns The name of the current node type, or null if editor is not available
 * 
 * @example
 * ```typescript
 * const nodeName = getCurrentElementName(editor);
 * if (nodeName === 'codeBlock') {
 *   // Handle code block specific logic
 * }
 * ```
 */
export function getCurrentElementName(editor: Editor | null): string | null {
  const info = getCurrentElementInfo(editor);
  return info?.nodeName || null;
}

/**
 * Checks if the cursor is currently positioned in a specific node type.
 * 
 * @param editor - The TipTap editor instance
 * @param nodeTypeName - The name of the node type to check for
 * @returns True if the cursor is in the specified node type
 * 
 * @example
 * ```typescript
 * if (isInNodeType(editor, 'codeBlock')) {
 *   // Apply code block specific behavior
 * }
 * 
 * if (isInNodeType(editor, 'heading')) {
 *   // Apply heading specific behavior
 * }
 * ```
 */
export function isInNodeType(editor: Editor | null, nodeTypeName: string): boolean {
  const currentName = getCurrentElementName(editor);
  return currentName === nodeTypeName;
}

/**
 * Gets the hierarchy path of the current cursor position.
 * Returns an array of node names from root to current position.
 * 
 * @param editor - The TipTap editor instance
 * @returns Array of node names representing the path from root to current position
 * 
 * @example
 * ```typescript
 * const path = getCurrentElementPath(editor);
 * // Example output: ['doc', 'paragraph'] or ['doc', 'blockquote', 'paragraph']
 * ```
 */
export function getCurrentElementPath(editor: Editor | null): string[] {
  if (!editor) {
    return [];
  }

  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  const path: string[] = [];
  
  for (let i = 0; i <= $from.depth; i++) {
    const node = $from.node(i);
    if (node) {
      path.push(node.type.name);
    }
  }

  return path;
}

/**
 * Gets detailed information about all ancestor nodes of the current cursor position.
 * 
 * @param editor - The TipTap editor instance
 * @returns Array of node information from root to current position
 * 
 * @example
 * ```typescript
 * const ancestors = getCurrentElementAncestors(editor);
 * ancestors.forEach((ancestor, depth) => {
 *   console.log(`Depth ${depth}: ${ancestor.nodeName}`, ancestor.attrs);
 * });
 * ```
 */
export function getCurrentElementAncestors(editor: Editor | null): Array<{
  nodeName: string;
  depth: number;
  attrs: Record<string, unknown>;
}> {
  if (!editor) {
    return [];
  }

  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  const ancestors: Array<{
    nodeName: string;
    depth: number;
    attrs: Record<string, unknown>;
  }> = [];
  
  for (let i = 0; i <= $from.depth; i++) {
    const node = $from.node(i);
    if (node) {
      ancestors.push({
        nodeName: node.type.name,
        depth: i,
        attrs: node.attrs || {},
      });
    }
  }

  return ancestors;
}