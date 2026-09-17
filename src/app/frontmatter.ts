import type { Editor } from "@tiptap/core";
import { editorActionsGlobalRef, editorGlobalRef } from "./editor-global-ref";

export const EMPTY_MARKDOWN_FRONTMATTER = "---\n\n---";

const MARKDOWN_FRONTMATTER_PATTERN = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export function hasMarkdownFrontmatter(content: string): boolean {
    return MARKDOWN_FRONTMATTER_PATTERN.test(content);
}

export function addMarkdownFrontmatter(content: string): string {
    if (hasMarkdownFrontmatter(content)) return content;
    const separator = content.length > 0 ? "\n\n" : "";
    return `${EMPTY_MARKDOWN_FRONTMATTER}${separator}${content}`;
}

export function addFrontmatterToCurrentEditor(): void {
    const actionHandle = editorActionsGlobalRef.current;
    if (actionHandle) {
        actionHandle.addFrontmatter();
        return;
    }

    const editor = editorGlobalRef.current;
    if (editor) addFrontmatterToEditor(editor);
}

export function addFrontmatterToEditor(editor: Editor): boolean {
    if (editor.isDestroyed || !editor.isEditable || !editor.schema.nodes.frontmatter) return false;

    let hasFrontmatter = false;
    editor.state.doc.descendants((node) => {
        if (node.type.name === "frontmatter") {
            hasFrontmatter = true;
            return false;
        }
        return true;
    });

    if (hasFrontmatter) {
        editor.commands.focus();
        return false;
    }

    return editor.chain().focus().insertContentAt(0, { type: "frontmatter" }).run();
}
