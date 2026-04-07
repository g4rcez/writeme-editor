import type { Extensions, JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import type { Node } from "@tiptap/pm/model";

export function tiptapToHtml({
  content,
  extensions,
}: {
  content: Node | JSONContent;
  extensions: Extensions;
}) {
  return renderToHTMLString({ content, extensions });
}
