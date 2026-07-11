import type { Marked, Tokens } from "marked";
import { Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";

const SUBSCRIPT_INPUT_REGEX = /(?:^|\s)~(?!~)(\S(?:[^~\n]*?\S)?)~$/;
const SUBSCRIPT_PASTE_REGEX = /(?:^|\s)~(?!~)(\S(?:[^~\n]*?\S)?)~(?!~)/g;
const SUBSCRIPT_MARKDOWN_TOKENIZER_REGEX = /^~(?!~)(\S(?:[^~\n]*?\S)?)~(?!~)/;

function registerSubscriptMarkdown(marked: Marked): void {
    marked.use({
        extensions: [
            {
                name: "subscript",
                level: "inline",
                start(src: string) {
                    return src.indexOf("~");
                },
                tokenizer(src: string) {
                    const match = SUBSCRIPT_MARKDOWN_TOKENIZER_REGEX.exec(src);
                    if (!match) return undefined;

                    return {
                        type: "subscript",
                        raw: match[0],
                        text: match[1],
                        tokens: this.lexer.inlineTokens(match[1]!),
                    } satisfies Tokens.Generic;
                },
                renderer(token: Tokens.Generic) {
                    return `<sub>${this.parser.parseInline(token.tokens ?? [])}</sub>`;
                },
            },
        ],
    });
}

export const Subscript = Mark.create({
    name: "subscript",

    parseHTML() {
        return [{ tag: "sub" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["sub", mergeAttributes(HTMLAttributes), 0];
    },

    addInputRules() {
        return [
            markInputRule({
                find: SUBSCRIPT_INPUT_REGEX,
                type: this.type,
            }),
        ];
    },

    addPasteRules() {
        return [
            markPasteRule({
                find: SUBSCRIPT_PASTE_REGEX,
                type: this.type,
            }),
        ];
    },

    addStorage() {
        return {
            markdown: {
                serialize: { open: "~", close: "~", expelEnclosingWhitespace: true },
                parse: {
                    setup(marked: Marked) {
                        registerSubscriptMarkdown(marked);
                    },
                },
            },
        };
    },
});
