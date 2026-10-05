import type { Extensions, JSONContent } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

export function tiptapToHtml({ content, extensions }: { content: Node | JSONContent; extensions: Extensions }) {
    return renderToHTMLString({ content, extensions });
}
