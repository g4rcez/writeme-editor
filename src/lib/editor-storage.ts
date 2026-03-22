import { type Note } from "@/store/note";
import { type Editor } from "@tiptap/core";

export const getEditorNote = (editor: Editor): Note | undefined =>
  (editor.storage as any).note as Note | undefined;

export const setEditorNote = (editor: Editor, note: Note | undefined): void => {
  (editor.storage as any).note = note;
};

export const getEditorAllNotes = (editor: Editor): Note[] =>
  (editor.storage as any).allNotes ?? [];

export const setEditorAllNotes = (editor: Editor, notes: Note[]): void => {
  (editor.storage as any).allNotes = notes;
};

export const getEditorMarkdown = (editor: Editor): string =>
  (editor.storage as any).markdown.getMarkdown() as string;
