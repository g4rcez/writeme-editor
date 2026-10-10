import type { Editor } from "@tiptap/react";

/**
 * Information about the current element where the cursor is positioned
 */
type CurrentElementInfo = {
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
function getCurrentElementInfo(editor: Editor | null): CurrentElementInfo | null {
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

export function updateNodeContent(editor: Editor, targetNode: any, newContent: string) {
    const { state } = editor;
    const { tr } = state;
    let updated = false;

    state.doc.descendants((node, pos) => {
        if (node === targetNode) {
            // Clear existing content and insert new content
            const from = pos + 1;
            const to = pos + node.nodeSize - 1;

            tr.delete(from, to);

            if (typeof newContent === "string") {
                tr.insert(from, state.schema.text(newContent));
            } else {
                tr.insert(from, newContent); // For rich content/fragments
            }

            updated = true;
            return false; // Stop traversal
        }
        return;
    });

    if (updated) {
        editor.view.dispatch(tr);
        return true;
    }
    return false;
}
