import type { Marked, Tokens } from "marked";
import { escapeHtml } from "./html";

export const footnoteDefinitionStart = /^ {0,3}\[\^[^\s[\]\\]+\]:/;

export function configureFootnoteMarkdown(markdown: Marked): void {
    markdown.use({
        extensions: [
            {
                name: "footnote_definition",
                level: "block",
                start(source: string) {
                    return source.search(/^ {0,3}\[\^[^\s[\]\\]+\]:/m);
                },
                tokenizer(source: string) {
                    const match = source.match(/^ {0,3}\[\^([^\s[\]\\]+)\]:[ \t]*([^\n]*)(?:\n|$)/);
                    if (!match) return undefined;
                    let raw = match[0];
                    let body = match[2] ?? "";
                    const lines = source.slice(raw.length).split(/(?<=\n)/);
                    let blanks = "";
                    for (const line of lines) {
                        if (/^[ \t]*\n$/.test(line)) {
                            blanks += line;
                            continue;
                        }
                        if (!/^(?: {4}|\t)/.test(line)) break;
                        raw += blanks + line;
                        body +=
                            "\n" +
                            blanks.replace(/^(?: {4}|\t)/gm, "") +
                            line.replace(/^(?: {4}|\t)/, "").replace(/\n$/, "");
                        blanks = "";
                    }
                    return {
                        type: "footnote_definition",
                        raw,
                        id: match[1] ?? "",
                        tokens: this.lexer.blockTokens(body),
                    };
                },
                childTokens: ["tokens"],
                renderer(token) {
                    const id = "id" in token && typeof token.id === "string" ? token.id : "";
                    const body = this.parser.parse((token as Tokens.Generic).tokens ?? []);
                    return `<section data-footnote-definition="${escapeHtml(id)}">${body || "<p></p>"}</section>\n`;
                },
            },
            {
                name: "footnote_reference",
                level: "inline",
                start(source: string) {
                    return source.indexOf("[^");
                },
                tokenizer(source: string) {
                    const match = source.match(/^\[\^([^\s[\]\\]+)\]/);
                    if (!match) return undefined;
                    const tokenizer = this.lexer.options.tokenizer;
                    if (
                        tokenizer?.link(source)?.type === "link" ||
                        tokenizer?.reflink(source, this.lexer.tokens.links)?.type === "link"
                    )
                        return undefined;
                    return { type: "footnote_reference", raw: match[0], id: match[1] ?? "" };
                },
                renderer(token) {
                    const id = "id" in token && typeof token.id === "string" ? token.id : "";
                    return `<span data-footnote-reference="${escapeHtml(id)}">[^${escapeHtml(id)}]</span>`;
                },
            },
        ],
    });
}
