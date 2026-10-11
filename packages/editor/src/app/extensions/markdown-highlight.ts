import Highlight from "@tiptap/extension-highlight";

export const MarkdownHighlight = Highlight.extend({
    priority: 30,
    addStorage() {
        return {
            markdown: {
                serialize: { open: "==", close: "==", expelEnclosingWhitespace: true },
            },
        };
    },
});
