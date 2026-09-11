import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import { Node } from "@tiptap/core";
import { configureBlockMathMarkdown, type MarkedLike } from "@/lib/latex-markdown";
import type { SerializeContext } from "../../serialize/types";

const BlockMath = Node.create({
    name: "blockMath",
});

export default BlockMath.extend({
    addStorage() {
        return {
            markdown: {
                serialize(this: SerializeContext, state: MarkdownSerializerState, node: ProseMirrorNode) {
                    state.write("$$");
                    state.ensureNewLine();
                    state.write(String(node.attrs.latex ?? ""));
                    state.ensureNewLine();
                    state.write("$$");
                    state.closeBlock(node);
                },
                parse: {
                    setup(marked: MarkedLike) {
                        configureBlockMathMarkdown(marked);
                    },
                },
            },
        };
    },
});
