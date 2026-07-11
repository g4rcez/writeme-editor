import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import { Node } from "@tiptap/core";
import { escapeHTML } from "../../util/dom";

const Text = Node.create({
    name: "text",
});

export default Text.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
                    state.text(escapeHTML(node.text ?? ""));
                },
                parse: {
                    // handled by markdown-it
                },
            },
        };
    },
});
