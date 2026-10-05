import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import { Node } from "@tiptap/core";
import { configureInlineMathMarkdown, type MarkedLike } from "@/lib/latex-markdown";
import type { SerializeContext } from "../../serialize/types";

const InlineMath = Node.create({
    name: "inlineMath",
});

export default InlineMath.extend({
    addStorage() {
        return {
            markdown: {
                serialize(this: SerializeContext, state: MarkdownSerializerState, node: ProseMirrorNode) {
                    state.text(`$${String(node.attrs.latex ?? "")}$`, false);
                },
                parse: {
                    setup(marked: MarkedLike) {
                        configureInlineMathMarkdown(marked);
                    },
                },
            },
        };
    },
});
