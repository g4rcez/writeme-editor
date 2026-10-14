import type { Marked, Tokens } from "marked";
import { decodeCodeResult } from "../app/elements/code-block/code-result";
import { escapeHtml } from "./html";

type KeptCodeToken = {
    raw: string;
    language: string;
    title: string | null;
    code: string;
    encodedResult: string;
};

function tokenizeKeptCode(src: string): KeptCodeToken | undefined {
    const match = src.match(
        /^<!-- writeme-code-result:v1:([A-Za-z0-9_-]+) -->\r?\n( {0,3})(`{3,}|~{3,})([^\r\n]*)\r?\n/,
    );
    if (!match) return undefined;
    const encodedResult = match[1] ?? "";
    if (!decodeCodeResult(encodedResult)) return undefined;
    const indent = match[2]?.length ?? 0;
    const fence = match[3] ?? "";
    const info = (match[4] ?? "").trim();
    if (fence[0] === "`" && info.includes("`")) return undefined;
    const remaining = src.slice(match[0].length);
    const closer = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*(?:\\r?\\n|$)`, "m").exec(remaining);
    if (!closer) return undefined;
    const code = remaining.slice(0, closer.index).replace(/\r?\n$/, "");
    const titleMatch = info.match(/title=(?:"([^"]*)"|'([^']*)'|(\S+))/);
    const title = titleMatch ? (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? null) : null;
    return {
        raw: match[0] + remaining.slice(0, closer.index + closer[0].length),
        language: titleMatch
            ? (info.slice(0, titleMatch.index).trim().split(/\s+/)[0] ?? "")
            : (info.split(/\s+/)[0] ?? ""),
        title,
        code: indent ? code.replace(new RegExp(`^ {0,${indent}}`, "gm"), "") : code,
        encodedResult,
    };
}

export function configureCodeResultMarkdown(marked: Marked): void {
    marked.use({
        extensions: [
            {
                name: "writeme_kept_code",
                level: "block",
                start(src: string) {
                    return src.indexOf("<!-- writeme-code-result:v1:");
                },
                tokenizer(src: string) {
                    const token = tokenizeKeptCode(src);
                    return token ? { type: "writeme_kept_code", ...token } : undefined;
                },
                renderer(genericToken: Tokens.Generic) {
                    const token = tokenizeKeptCode(genericToken.raw);
                    if (!token) return "";
                    const language = token.language ? ` class="language-${escapeHtml(token.language)}"` : "";
                    const title = token.title ? ` data-title="${escapeHtml(token.title)}"` : "";
                    return `<pre data-writeme-execution-result="${token.encodedResult}"${title}><code${language}>${escapeHtml(token.code)}</code></pre>\n`;
                },
            },
        ],
    });
}
