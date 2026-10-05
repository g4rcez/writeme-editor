import type { Editor } from "@tiptap/core";
import type { Note } from "@/store/note";

export type EditorMentionItem = {
    id: string;
    label: string;
    path: string;
    filePath?: string | null;
    searchText?: string;
    kind: "note" | "file";
};

export const getEditorNote = (editor: Editor): Note | undefined => (editor.storage as any).note as Note | undefined;

export const setEditorNote = (editor: Editor, note: Note | undefined): void => {
    (editor.storage as any).note = note;
};

export const getEditorAllNotes = (editor: Editor): Note[] => (editor.storage as any).allNotes ?? [];

export const setEditorAllNotes = (editor: Editor, notes: Note[]): void => {
    (editor.storage as any).allNotes = notes;
};

export const getEditorMentionItems = (editor: Editor): EditorMentionItem[] | undefined => {
    const mentionItems: unknown = Reflect.get(editor.storage, "mentionItems");
    if (!Array.isArray(mentionItems)) return undefined;
    return mentionItems.filter(isEditorMentionItem);
};

function isEditorMentionItem(value: unknown): value is EditorMentionItem {
    if (!value || typeof value !== "object") return false;
    return (
        "id" in value &&
        typeof value.id === "string" &&
        "label" in value &&
        typeof value.label === "string" &&
        "path" in value &&
        typeof value.path === "string" &&
        "kind" in value &&
        (value.kind === "note" || value.kind === "file")
    );
}

export const setEditorMentionItems = (editor: Editor, items: EditorMentionItem[]): void => {
    Reflect.set(editor.storage, "mentionItems", items);
};

export const getEditorMarkdown = (editor: Editor): string => {
    if (!editor.schema || !editor.extensionManager) return "";

    const markdownStorage = (editor.storage as { markdown?: { getMarkdown?: (() => string) | null } }).markdown;
    return markdownStorage?.getMarkdown?.() ?? "";
};
