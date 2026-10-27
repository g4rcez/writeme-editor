import { isSecondaryWindow } from "@/lib/window-mode";
import { marked, type Token } from "marked";
import { parse as parseYaml } from "yaml";
import { getRelativePath } from "@/lib/file-utils";
import { findHashtags, hashtagKey, hashtagSuffix, normalizeHashtag } from "@/lib/hashtags";
import { isElectron } from "@/lib/is-electron";
import { encodeMarkdownFilePath, escapeMarkdownLinkLabel } from "@/lib/markdown-links";
import { isPathWithinImportRoot } from "@/lib/obsidian-import";
import { getWorkspaceKey, globalState, repositories } from "@/store/global.store";
import { filterMentionItems } from "./mention-search";
import { workspaceCompletionFiles } from "./workspace-completion-files";

export type CompletionContext = {
    trigger: "#" | "@" | "word";
    query: string;
    from: number;
    to: number;
    cursor: number;
    textAfter?: string;
};

export type CompletionItem = {
    id: string;
    label: string;
    path: string;
    kind: "heading" | "tag" | "file" | "word";
    description?: string;
};

export function completionWorkspaceKey(): string {
    return getWorkspaceKey(globalState().directory);
}

const noteTagCache = new WeakMap<object, { content: string; tags: string[] }>();

function noteCompletionTags(note: { content: string }): string[] {
    const cached = noteTagCache.get(note);
    if (cached?.content === note.content) return cached.tags;
    const tags = extractCompletionTags(note.content);
    noteTagCache.set(note, { content: note.content, tags });
    return tags;
}

export function createTagItems(values: Iterable<string>): CompletionItem[] {
    const labels = new Map<string, string>();
    for (const value of values) {
        const label = normalizeHashtag(value);
        if (label && !labels.has(hashtagKey(label))) labels.set(hashtagKey(label), label);
    }
    return [...labels.values()]
        .sort((left, right) => left.localeCompare(right))
        .map((label) => ({ id: `tag:${hashtagKey(label)}`, label, path: `#${label}`, kind: "tag" }));
}

export function withoutActiveTag(items: CompletionItem[], context: CompletionContext): CompletionItem[] {
    const suffix = context.textAfter?.slice(0, context.to - context.cursor) ?? "";
    const active = hashtagKey(context.query + suffix);
    return items.filter((item) => hashtagKey(item.label) !== active);
}

export function findCompletionContext(
    before: string,
    after: string,
    cursor: number,
    active?: CompletionContext,
): CompletionContext | null {
    if (active?.trigger === "#") {
        const offset = active.from - (cursor - before.length);
        const query = before.slice(offset + 1);
        if (offset >= 0 && before[offset] === "#" && !/[#@\n[\]]/.test(query)) {
            const suffix = hashtagSuffix(after);
            return { trigger: "#", query, from: active.from, to: cursor + suffix.length, cursor, textAfter: after };
        }
    }
    const match = before.match(/(?:^|[\s(])(#)([^\s#@\n[\]]*)$|(?:^|[\s(])(@)([^#@\n[\]]*)$/);
    const trigger = match?.[1] ?? match?.[3];
    if (match && (trigger === "#" || trigger === "@")) {
        const query = match[2] ?? match[4] ?? "";
        const from = cursor - query.length - 1;
        if (before.slice(0, before.length - query.length - 1).endsWith("](")) return null;
        const suffix = trigger === "#" ? hashtagSuffix(after) : (after.match(/^[^\s#@[\]<>,"'?!)]*/)?.[0] ?? "");
        return { trigger, query, from, to: cursor + suffix.length, cursor, textAfter: after };
    }
    if (/[#@]/.test(before.match(/[^\s(]*$/)?.[0] ?? "")) return null;
    const query = before.match(/[\p{L}\p{M}\p{N}_'’-]+$/u)?.[0] ?? "";
    const suffix = after.match(/^[\p{L}\p{M}\p{N}_'’-]+/u)?.[0] ?? "";
    if (!/\p{L}/u.test(query + suffix)) return null;
    return { trigger: "word", query, from: cursor - query.length, to: cursor + suffix.length, cursor };
}

export function createWordItems(text: string): CompletionItem[] {
    const words = new Map<string, string>();
    for (const match of text.matchAll(/[\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*(?:['’-][\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*)*/gu)) {
        const label = match[0];
        if (!/\p{L}/u.test(label)) continue;
        const key = hashtagKey(label);
        if (!words.has(key)) words.set(key, label);
    }
    return [...words].map(([key, label]) => ({ id: `word:${key}`, label, path: "", kind: "word" }));
}

export function filterWordItems(items: CompletionItem[], query: string): CompletionItem[] {
    const prefix = hashtagKey(query);
    return items
        .filter((item) => {
            const word = hashtagKey(item.label);
            return word.startsWith(prefix) && word !== prefix;
        })
        .sort((left, right) => left.label.localeCompare(right.label))
        .slice(0, 40);
}

export function createHeadingItems(titles: string[]): CompletionItem[] {
    const slugs = new Set<string>();
    return titles
        .filter((title) => title.trim())
        .map((label, index) => {
            const base =
                label
                    .trim()
                    .normalize("NFC")
                    .toLocaleLowerCase()
                    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
                    .replace(/\s+/g, "-") || "section";
            let slug = base;
            let suffix = 1;
            while (slugs.has(slug)) slug = `${base}-${suffix++}`;
            slugs.add(slug);
            return { id: `heading:${index}`, label, path: `#${encodeURIComponent(slug)}`, kind: "heading" };
        });
}

export function filterCompletionItems(items: CompletionItem[], query: string): CompletionItem[] {
    const byId = new Map(items.map((item) => [item.id, item]));
    return filterMentionItems(
        [...byId.values()].map((item) => ({ ...item, kind: "file" as const })),
        query,
    ).flatMap((item) => byId.get(item.id) ?? []);
}

export async function loadWorkspaceCompletions(trigger: "#" | "@", editingNoteId?: string): Promise<CompletionItem[]> {
    const state = globalState();
    const directory = state.directory;
    const workspaceKey = getWorkspaceKey(directory);
    const notes = state.notes.filter((note) => {
        if (note.deletedAt) return false;
        if (note.filePath) return directory !== null && isPathWithinImportRoot(directory, note.filePath);
        return note.project === workspaceKey || (!directory && ["", "default"].includes(note.project));
    });
    if (trigger === "@") {
        if (isElectron() && directory) {
            const files = await workspaceCompletionFiles.load(directory, window.electronAPI.fs);
            return files.map((file) => ({
                id: `file:${file.relativePath.replaceAll("\\", "/")}`,
                label: file.name,
                path: file.relativePath.replaceAll("\\", "/"),
                description: file.relativePath.replaceAll("\\", "/"),
                kind: "file",
            }));
        }
        return notes.map((note) => ({
            id: note.id,
            label: note.title || "Untitled",
            path: note.filePath && directory ? getRelativePath(directory, note.filePath) : `/note/${note.id}`,
            kind: "file",
        }));
    }

    const filenames = new Set(notes.flatMap((note) => [note.id, note.title, note.filePath].filter(Boolean)));
    const storedTags = await repositories.hashtags.getAll();
    const tags = new Set(
        notes.flatMap((note) => [...note.tags, ...(note.id === editingNoteId ? [] : noteCompletionTags(note))]),
    );
    for (const tag of storedTags) {
        // floating windows only hold note metadata, so the tags of the listed notes must come from the stored hashtags
        if (tag.project === workspaceKey && (isSecondaryWindow || !filenames.has(tag.filename))) tags.add(tag.hashtag);
    }
    return createTagItems(tags);
}

export function extractCompletionTags(content: string): string[] {
    const tags = new Set<string>();
    const frontmatter = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (frontmatter) {
        try {
            const metadata: unknown = parseYaml(frontmatter[1] ?? "");
            if (metadata && typeof metadata === "object" && "tags" in metadata) {
                const values = Array.isArray(metadata.tags)
                    ? metadata.tags
                    : typeof metadata.tags === "string"
                      ? metadata.tags.split(",")
                      : [];
                for (const tag of values) if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
            }
        } catch {
            tags.clear();
        }
        content = content.slice(frontmatter[0].length);
    }
    marked.walkTokens(marked.lexer(content), (token: Token) => {
        if (token.type !== "text" || !("text" in token)) return;
        for (const { tag } of findHashtags(token.text)) tags.add(tag);
    });
    return [...tags];
}

export function completionMarkdown(item: CompletionItem): string {
    if (item.kind === "word") return item.label;
    if (item.kind === "tag") return `#${item.label}`;
    const label = escapeMarkdownLinkLabel(item.label);
    const path = item.kind === "heading" ? item.path : encodeMarkdownFilePath(item.path);
    const title =
        item.kind === "file" && item.id.startsWith("file:")
            ? ` "writeme-mention:${item.id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
            : "";
    return `[${label}](${path}${title})`;
}

export function markdownHeadingText(source: string): string {
    const template = document.createElement("template");
    template.innerHTML = marked.parseInline(source, { async: false });
    template.content.querySelectorAll("script, style").forEach((node) => node.remove());
    return template.content.textContent?.trim() ?? "";
}

export function completionInsertionContext(item: CompletionItem, context: CompletionContext): CompletionContext {
    if (item.kind !== "file" || context.textAfter === undefined) return context;
    for (const target of [item.path, item.label]) {
        if (!hashtagKey(target).startsWith(hashtagKey(context.query))) continue;
        const remaining = target.slice(context.query.length);
        if (remaining && context.textAfter.startsWith(remaining))
            return { ...context, to: context.cursor + remaining.length };
    }
    return context;
}
