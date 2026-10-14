import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Marked, Tokens } from "marked";
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
                    setup(marked: Marked): void {
                        marked.use({
                            renderer: {
                                html(token: Tokens.HTML | Tokens.Tag): string | false {
                                    if (!/<!-- writeme-comment-(?:status|history):/.test(token.raw)) return false;
                                    // Marked omits space tokens between blocks in rendered HTML.
                                    // Keep the source block boundary distinct from inline comments.
                                    return token.block ? `${token.raw}\n` : token.raw;
                                },
                            },
                        });
                    },
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
                            const standalone =
                                comment.parentElement === element.firstElementChild &&
                                (!comment.previousSibling ||
                                    (comment.previousSibling.nodeType === window.Node.TEXT_NODE &&
                                        /\n$/.test(comment.previousSibling.textContent ?? ""))) &&
                                (!comment.nextSibling ||
                                    (comment.nextSibling.nodeType === window.Node.TEXT_NODE &&
                                        /^\n/.test(comment.nextSibling.textContent ?? "")));
                            const metadata = document.createElement(standalone ? "div" : "span");
                            metadata.setAttribute(
                                standalone ? "data-comment-review" : "data-comment-review-inline",
                                `<!--${comment.data}-->`,
                            );
                            comment.replaceWith(metadata);
                        }
                    },
                },
            },
        };
    },
});

export const CommentReviewInline = Node.create({
    name: "commentReviewInline",
    group: "inline",
    inline: true,
    atom: true,
    selectable: false,
    addAttributes() {
        return {
            raw: {
                default: "",
                parseHTML: (element: HTMLElement) => element.getAttribute("data-comment-review-inline"),
            },
        };
    },
    parseHTML() {
        return [{ tag: "span[data-comment-review-inline]" }];
    },
    renderHTML({ node }) {
        return ["span", { "data-comment-review-inline": node.attrs.raw, hidden: "", "aria-hidden": "true" }];
    },
    addStorage() {
        return {
            markdown: {
                serialize(state: MarkdownSerializerState, node: ProseMirrorNode): void {
                    state.write(String(node.attrs.raw));
                },
            },
        };
    },
});
