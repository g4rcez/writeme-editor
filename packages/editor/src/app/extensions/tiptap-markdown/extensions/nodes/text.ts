import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Node } from "@tiptap/core";
import type { MarkdownSerializerState } from "../../serialize/state";

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
                    state.text(state.escapeLiteralText(node.text ?? ""), false);
                },
                parse: {
                    // handled by markdown-it
                },
            },
        };
    },
});
