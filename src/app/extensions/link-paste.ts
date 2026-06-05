import type { Editor } from "@tiptap/core";

const externalHttpUrlRegex = /^https?:\/\/[^\s<>"')]+$/i;

export function getPastedExternalHttpUrl(
  text: string | undefined,
): string | null {
  const href = text?.trim();

  if (!href || !externalHttpUrlRegex.test(href)) {
    return null;
  }

  return href;
}

export function applyPastedUrlToSelection(
  editor: Editor | null,
  text: string | undefined,
): boolean {
  const href = getPastedExternalHttpUrl(text);

  if (!editor || !href || editor.state.selection.empty) {
    return false;
  }

  if (!editor.state.schema.marks.link) {
    return false;
  }

  return editor.chain().focus().setMark("link", { href }).run();
}
