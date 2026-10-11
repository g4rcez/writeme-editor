import { lexer, walkTokens, type Tokens } from "marked";
import { posix } from "node:path";
import type { JsonValue, SavedNote } from "./contracts.js";

export type Heading = { text: string; level: number; offset: number; end: number };
export type CommentThread = { id: string; quote: string; comments: string[] };

export function stripAssets(text: string): string {
    return text.replace(/data:[^\s"'<>)]*/gi, "[embedded asset omitted]");
}

export function safeValue(value: JsonValue, depth = 0, state?: { truncated: boolean }): JsonValue {
    if (depth > 12) {
        if (state) state.truncated = true;
        return { truncated: true, reason: "Maximum nesting depth exceeded" };
    }
    if (typeof value === "string") {
        const clean = stripAssets(value);
        if (clean.length > 16000 && state) state.truncated = true;
        return clean.length > 16000
            ? { text: clean.slice(0, 16000), totalCharacters: clean.length, truncated: true }
            : clean;
    }
    if (Array.isArray(value)) {
        if (value.length > 200 && state) state.truncated = true;
        const items = value.slice(0, 200).map((item) => safeValue(item, depth + 1, state));
        return value.length > 200 ? { items, total: value.length, truncated: true } : items;
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                /^(files|dataURL|base64|imageData)$/i.test(key)
                    ? "[embedded asset omitted]"
                    : safeValue(item, depth + 1, state),
            ]),
        );
    }
    return value;
}

export function sanitizedJson(value: JsonValue): string {
    return JSON.stringify(value, (key: string, item: unknown) => {
        if (/^(files|dataURL|base64|imageData)$/i.test(key)) return "[embedded asset omitted]";
        return typeof item === "string" ? stripAssets(item) : item;
    });
}

export function outline(content: string): Heading[] {
    const result: Heading[] = [];
    const removedOffsets: number[] = [];
    const normalized = content.replace(/\r\n|\r/g, (match: string, index: number) => {
        if (match.length === 2) removedOffsets.push(index - removedOffsets.length);
        return "\n";
    });
    const originalOffset = (offset: number): number =>
        offset + removedOffsets.filter((index) => index < offset).length;
    const frontmatter = /^\uFEFF?---\n[\s\S]*?\n(?:---|\.\.\.)(?:\n|$)/.exec(normalized);
    let offset = frontmatter?.[0].length ?? 0;
    for (const token of lexer(normalized.slice(offset))) {
        if (token.type === "heading")
            result.push({
                text: token.text,
                level: token.depth,
                offset: originalOffset(offset),
                end: content.length,
            });
        offset += token.raw.length;
    }
    return result.map((heading, index) => ({
        ...heading,
        end: result.slice(index + 1).find((next) => next.level <= heading.level)?.offset ?? content.length,
    }));
}

export function parseCommentThreads(content: string): CommentThread[] {
    const threads: CommentThread[] = [];
    let thread: CommentThread | undefined;
    let quoteSeen = false;
    for (const token of lexer(content)) {
        if (token.type === "heading" && token.depth === 2) {
            const id = token.text.trim();
            quoteSeen = false;
            thread = threads.find((entry) => entry.id === id);
            if (!thread) {
                thread = { id, quote: "", comments: [] };
                threads.push(thread);
            }
        } else if (token.type === "heading" && token.depth < 2) thread = undefined;
        else if (thread && token.type === "blockquote" && !quoteSeen) {
            quoteSeen = true;
            if (!thread.quote) thread.quote = token.text.trim();
        } else if (thread && token.type === "list") {
            thread.comments.push(
                ...token.items.map((item: Tokens.ListItem) => normalizeCommentText(item.text)),
            );
        } else if (thread && token.type !== "space") thread.comments.push(token.raw.trim());
    }
    return threads;
}

function normalizeCommentText(text: string): string {
    let fence: string | undefined;
    return text
        .trimEnd()
        .split("\n")
        .map((line) => {
            const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
            if (marker) {
                if (!fence) fence = marker;
                else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
                return line;
            }
            return fence ? line : line.replace(/[ \t]{2,}$/, "");
        })
        .join("\n");
}

export function noteLinks(note: SavedNote, notes: SavedNote[]): { href: string; ref: string | null }[] {
    const hrefs = new Set<string>();
    walkTokens(lexer(note.content ?? ""), (token) => {
        if (token.type === "link") hrefs.add(token.href);
        if (token.type === "text")
            for (const match of token.text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) hrefs.add(match[1]!);
    });
    return [...hrefs].map((href) => {
        let decoded: string;
        try {
            decoded = decodeURIComponent(href.split("#")[0]!);
        } catch {
            return { href, ref: null };
        }
        if (!decoded) return { href, ref: note.ref };
        if (/^[a-z]+:/i.test(decoded) || decoded.startsWith("/")) return { href, ref: null };
        const path = posix.normalize(posix.join(posix.dirname(note.path ?? note.title), decoded));
        const candidates = notes.filter(
            (entry) =>
                entry.root === note.root &&
                (entry.path === path ||
                    entry.path === `${path}.md` ||
                    (!entry.path &&
                        (entry.title === decoded ||
                            `${entry.title}.md` === decoded ||
                            entry.title === path.replace(/\.md$/i, "")))),
        );
        return { href, ref: candidates.length === 1 ? candidates[0]!.ref : null };
    });
}

export function parseDrawing(content: string): Record<string, JsonValue> {
    const fenced = lexer(content).find(
        (token) => token.type === "code" && token.lang?.toLowerCase() === "json",
    );
    const value: JsonValue = JSON.parse(fenced?.type === "code" ? fenced.text : content) as JsonValue;
    if (Array.isArray(value)) return { elements: value };
    if (!value || typeof value !== "object") throw new Error("Drawing must be an object or element array");
    return value;
}
