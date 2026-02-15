import type { Extensions, JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import type { Node } from "@tiptap/pm/model";

/**
 * Renders Tiptap content to HTML string.
 * Note: Despite the name, this currently returns HTML. 
 * For Markdown, use editor.storage.markdown.getMarkdown()
 */
export function tiptapToMarkdown({
  content,
  extensions,
}: {
  content: Node | JSONContent;
  extensions: Extensions;
}) {
  return renderToHTMLString({ content, extensions });
}