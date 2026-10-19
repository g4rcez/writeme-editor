import type { EditorEvents } from "@tiptap/core";

export function initializeEditorDocument({ editor }: EditorEvents["mount"]): void {
    // Normalize trailing nodes before mobile/Safari focus can dispatch inside a pending command.
    editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false).setMeta("preventUpdate", true));
}
