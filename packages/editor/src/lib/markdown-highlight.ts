import type { Marked, TokenizerExtension } from "marked";

export function configureHighlightMarkdown(markdown: Marked): void {
    const highlight: TokenizerExtension = {
        name: "highlight",
        level: "inline",
        start: (source) => source.indexOf("=="),
        tokenizer(source) {
            const match = /^==(?=\S)([^\n]+?\S|\S)==/.exec(source);
            if (!match?.[1]) return undefined;
            return { type: "highlight", raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
        },
    };
    markdown.use({
        extensions: [
            {
                ...highlight,
                renderer(token) {
                    return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`;
                },
            },
        ],
    });
}
