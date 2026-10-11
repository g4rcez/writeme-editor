import { lexer, type Tokens } from "marked";
import type { Note } from "@/store/note";

export type CommentThread = { id: string; quote: string; comments: string[] };
export type CommentCompanion = { title: string; filePath: string | null; href: string };

export function commentSlug(text: string): string {
    return (
        text
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-+|-+$/g, "") || "comment"
    );
}

export function getCommentCompanion(note: Note): CommentCompanion {
    const path = (note.filePath ?? note.title).replaceAll("\\", "/").replace(/\.md$/i, "");
    const slash = path.lastIndexOf("/");
    const filename = `comments_${path.slice(slash + 1)}.md`;
    return {
        title: note.filePath ? filename.slice(0, -3) : `${path.slice(0, slash + 1)}${filename.slice(0, -3)}`,
        filePath: note.filePath ? `${path.slice(0, slash + 1)}${filename}` : null,
        href: `./${encodeURIComponent(filename)}`,
    };
}

export function getCommentId(href: unknown, note: Note): string | null {
    if (typeof href !== "string") return null;
    const hash = href.indexOf("#");
    if (hash < 0) return null;
    try {
        const aliases = note.metadata?.commentReferenceHrefs;
        const targets = [
            getCommentCompanion(note).href,
            ...(Array.isArray(aliases) ? aliases.filter((alias): alias is string => typeof alias === "string") : []),
        ];
        if (!targets.some((target) => decodeURIComponent(href.slice(0, hash)) === decodeURIComponent(target)))
            return null;
        return decodeURIComponent(href.slice(hash + 1)) || null;
    } catch {
        return null;
    }
}

export function getCommentReferenceHref(reference: Note): string {
    const filename = (reference.filePath ?? reference.title).replaceAll("\\", "/").split("/").pop() ?? reference.title;
    return `./${encodeURIComponent(/\.md$/i.test(filename) ? filename : `${filename}.md`)}`;
}

export function parseCommentThreads(content: string): CommentThread[] {
    const threads: CommentThread[] = [];
    let thread: CommentThread | undefined;
    let sectionQuoteSeen = false;
    for (const token of lexer(content)) {
        if (token.type === "heading" && token.depth === 2) {
            const id = token.text.trim();
            sectionQuoteSeen = false;
            thread = threads.find((entry) => entry.id === id);
            if (!thread) {
                thread = { id, quote: "", comments: [] };
                threads.push(thread);
            }
        } else if (token.type === "heading" && token.depth < 2) {
            thread = undefined;
        } else if (thread && token.type === "blockquote" && !sectionQuoteSeen) {
            sectionQuoteSeen = true;
            if (!thread.quote) thread.quote = token.text.trim();
        } else if (thread && token.type === "list") {
            thread.comments.push(...token.items.map((item: Tokens.ListItem) => normalizeCommentText(item.text)));
        } else if (thread && token.type !== "space") {
            thread.comments.push(token.raw.trim());
        }
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

export function uniqueCommentId(text: string, used: Iterable<string>): string {
    const ids = new Set(used);
    const base = commentSlug(text);
    let id = base;
    let suffix = 2;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    return id;
}

export function appendNoteComment(content: string, id: string, quote: string, body: string): string {
    const entry = `- ${body.trim().replaceAll("\n", "\n  ")}\n`;
    let offset = 0;
    let start: number | null = null;
    let end = content.length;
    for (const token of lexer(content)) {
        if (token.type === "heading" && token.depth <= 2) {
            if (start !== null) {
                end = offset;
                break;
            }
            if (token.depth === 2 && token.text.trim() === id) start = offset + token.raw.length;
        }
        offset += token.raw.length;
    }
    if (start !== null) {
        return `${content.slice(0, end).trimEnd()}\n\n${entry}\n${content.slice(end)}`;
    }
    const quoted = quote.replaceAll("\n", "\n> ");
    return `${content.trimEnd()}\n\n## ${id}\n\n> ${quoted}\n\n${entry}`.trimStart();
}
