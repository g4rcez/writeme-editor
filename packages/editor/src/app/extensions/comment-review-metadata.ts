import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import { Node } from "@tiptap/core";

export const CommentReviewMetadata = Node.create({
    name: "commentReviewMetadata",
    group: "block",
    atom: true,
    selectable: false,
    addAttributes() {
        return {
            raw: { default: "", parseHTML: (element: HTMLElement) => element.getAttribute("data-comment-review") },
        };
    },
    parseHTML() {
        return [{ tag: "div[data-comment-review]" }];
    },
    renderHTML({ node }) {
        return ["div", { "data-comment-review": node.attrs.raw, hidden: "", "aria-hidden": "true" }];
    },
    addStorage() {
        return {
            markdown: {
                serialize(state: MarkdownSerializerState, node: ProseMirrorNode): void {
                    state.write(String(node.attrs.raw));
                    state.closeBlock(node);
                },
                parse: {
                    updateDOM(element: HTMLElement): void {
                        const walker = document.createTreeWalker(element, window.NodeFilter.SHOW_COMMENT);
                        const comments: Comment[] = [];
                        while (walker.nextNode()) comments.push(walker.currentNode as Comment);
                        for (const comment of comments) {
                            if (
                                !/^ writeme-comment-(?:status: (?:resolved|unresolved)|history: \{[^\n]*\}) $/.test(
                                    comment.data,
                                )
                            )
                                continue;
                            const metadata = document.createElement("div");
                            metadata.setAttribute("data-comment-review", `<!--${comment.data}-->`);
                            comment.replaceWith(metadata);
                        }
                    },
                },
            },
        };
    },
});
