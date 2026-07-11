import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import { getHTMLFromFragment, Node } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { SerializeContext } from "../../serialize/types";
import { elementFromString } from "../../util/dom";

export default Node.create({
    name: "markdownHTMLNode",
    addStorage() {
        return {
            markdown: {
                serialize(
                    this: SerializeContext,
                    state: MarkdownSerializerState,
                    node: ProseMirrorNode,
                    parent: ProseMirrorNode | Fragment,
                ) {
                    if (this.editor.storage.markdown.options.html) {
                        state.write(serializeHTML(node, parent));
                    } else {
                        console.warn(`Tiptap Markdown: "${node.type.name}" node is only available in html mode`);
                        state.write(`[${node.type.name}]`);
                    }
                    if (node.isBlock) {
                        state.closeBlock(node);
                    }
                },
                parse: {
                    // handled by markdown-it
                },
            },
        };
    },
});

function serializeHTML(node: ProseMirrorNode, parent: ProseMirrorNode | Fragment): string {
    const schema = node.type.schema;
    const html = getHTMLFromFragment(Fragment.from(node), schema);

    if (node.isBlock && (parent instanceof Fragment || parent.type.name === schema.topNodeType.name)) {
        return formatBlock(html);
    }

    return html;
}

/**
 * format html block as per the commonmark spec
 */
function formatBlock(html: string): string {
    const dom = elementFromString(html);
    const element = dom.firstElementChild;

    if (!element) return html;

    const inner = element.innerHTML.trim();
    // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled prosemirror schema HTML
    element.innerHTML = inner ? `\n${inner}\n` : `\n`;

    return element.outerHTML;
}
