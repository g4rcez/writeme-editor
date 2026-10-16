import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Note } from "@/store/note";
import { findCompatibleNotes, getNoteAliases } from "@/lib/note-lookup";
import {
    isImageAttachmentTarget,
    isPdfAttachmentTarget,
    isVideoAttachmentTarget,
    parseObsidianLink,
} from "@/lib/obsidian-links";
import { isLatexFilePath } from "@/types/workspace-files";
import { decodeMarkdownFilePath } from "./markdown-links";
import { markdownLineToPlainText } from "./markdown-text";

export type NoteLinkReference = {
    kind: "id" | "wiki";
    raw: string;
    target: string;
    label: string;
    subpath?: string;
    markdown?: { label: string; title?: string | null };
    from: number;
    to: number;
};

export type ResolvedNoteLink = {
    note: Note;
    references: NoteLinkReference[];
};

export type IncomingNoteLink = {
    note: Note;
    excerpt: string;
};

export type UnresolvedNoteReference = {
    reference: NoteLinkReference;
    candidates: Note[];
};

export type UnlinkedNoteMention = {
    source: Note;
    text: string;
    from: number;
    to: number;
    excerpt: string;
    candidates: Note[];
};

const WIKI_LINK_PATTERN = /!?\[\[[^\]\n]+\]\]/g;
const APP_NOTE_LINK_PATTERN = /app:\/\/note\/([^\s<>"')\]]+)/g;

export function extractNoteLinkReferences(content: string): NoteLinkReference[] {
    const searchable = maskMarkdownNonText(content, false);
    const tree = markdownParser.parse(content);
    const definitions = new Map<string, { url: string; title?: string | null }>();
    visit(tree, "definition", (node) => {
        definitions.set(node.identifier, node);
    });
    const protectedRanges: Array<{ from: number; to: number }> = [];
    const references = new Map<string, NoteLinkReference>();
    const add = (reference: NoteLinkReference): void => {
        references.set([reference.kind, reference.target, reference.from].join(":"), reference);
    };

    visit(tree, (node) => {
        if (!["link", "linkReference", "image", "imageReference", "definition"].includes(node.type)) return;
        const from = node.position?.start.offset;
        const to = node.position?.end.offset;
        if (from === undefined || to === undefined) return;
        protectedRanges.push({ from, to });
        if (node.type !== "link" && node.type !== "linkReference") return;
        const raw = content.slice(from, to);
        if (parseObsidianLink(raw) || !searchable.slice(from, to).trim()) return;
        const destination = node.type === "link" ? node : definitions.get(node.identifier);
        if (!destination || destination.title?.startsWith("writeme-mention:file:")) return;
        const markedTarget = destination.title?.startsWith("writeme-mention:")
            ? destination.title.slice("writeme-mention:".length)
            : undefined;
        const pathTarget = destination.url.match(/^(?:\/note\/|app:\/\/note\/)([^/?#]+)/)?.[1];
        const target = markedTarget ?? (pathTarget ? decodeMarkdownFilePath(pathTarget) : undefined);
        if (!target) return;
        const labelFrom = node.children[0]?.position?.start.offset;
        const labelTo = node.children.at(-1)?.position?.end.offset;
        const rawLabel = labelFrom !== undefined && labelTo !== undefined ? content.slice(labelFrom, labelTo) : "";
        let label = "";
        visit(node, (child) => {
            if (child.type === "text" || child.type === "inlineCode") label += child.value;
        });
        add({
            kind: "id",
            raw,
            target,
            label,
            from,
            to,
            subpath: destination.url.match(/[?#].*$/)?.[0],
            markdown: markedTarget ? undefined : { label: rawLabel, title: destination.title },
        });
    });

    const wikiMatches = [...searchable.matchAll(WIKI_LINK_PATTERN)];
    const wikiRanges = wikiMatches.map((match) => ({ from: match.index, to: match.index + match[0].length }));
    for (const match of searchable.matchAll(APP_NOTE_LINK_PATTERN)) {
        const from = match.index;
        const to = from + match[0].length;
        if ([...protectedRanges, ...wikiRanges].some((range) => from >= range.from && to <= range.to)) continue;
        const target = match[1]?.split(/[?#]/)[0];
        if (target)
            add({
                kind: "id",
                raw: match[0],
                target: decodeMarkdownFilePath(target),
                label: target,
                from,
                to,
                subpath: match[0].match(/[?#].*$/)?.[0],
            });
    }

    for (const match of wikiMatches) {
        const raw = match[0];
        const from = match.index;
        const to = from + raw.length;
        if (
            protectedRanges.some(
                (range) => from >= range.from && to <= range.to && (from !== range.from || to !== range.to),
            )
        )
            continue;
        const link = parseObsidianLink(raw);
        if (!link?.target || isAttachmentTarget(link.target)) continue;
        add({ kind: "wiki", raw, target: link.target, label: link.display, from, to });
    }
    return [...references.values()];
}

export type WorkspaceFileReference = {
    raw: string;
    path: string;
    label: string;
    from: number;
    to: number;
};

export function extractWorkspaceFileReferences(content: string): WorkspaceFileReference[] {
    const tree = markdownParser.parse(content);
    const definitions = new Map<string, { url: string; title?: string | null }>();
    visit(tree, "definition", (node) => {
        definitions.set(node.identifier, node);
    });
    const references: WorkspaceFileReference[] = [];
    visit(tree, (node) => {
        if (node.type !== "link" && node.type !== "linkReference") return;
        const from = node.position?.start.offset;
        const to = node.position?.end.offset;
        if (from === undefined || to === undefined) return;
        const destination = node.type === "link" ? node : definitions.get(node.identifier);
        if (!destination?.title?.startsWith("writeme-mention:file:")) return;
        let label = "";
        visit(node, (child) => {
            if (child.type === "text" || child.type === "inlineCode") label += child.value;
        });
        references.push({
            raw: content.slice(from, to),
            path: decodeMarkdownFilePath(destination.url),
            label,
            from,
            to,
        });
    });
    return references;
}

export function canRepairNoteConnections(note: Note): boolean {
    return !["json", "excalidraw", "freehand", "pdf"].includes(note.noteType) && !isLatexFilePath(note.filePath);
}

export function findUnresolvedNoteLinks(note: Note, notes: readonly Note[]): UnresolvedNoteReference[] {
    if (!canRepairNoteConnections(note)) return [];
    return extractNoteLinkReferences(note.content).flatMap((reference) => {
        if (notes.some((candidate) => candidate.id === reference.target)) return [];
        const candidates = reference.kind === "wiki" ? findCompatibleNotes(notes, reference.target) : [];
        return candidates.length === 1 ? [] : [{ reference, candidates }];
    });
}

export function resolveNoteLinks(note: Note, notes: readonly Note[]): ResolvedNoteLink[] {
    const resolved = new Map<string, ResolvedNoteLink>();

    for (const reference of extractNoteLinkReferences(note.content)) {
        const target = resolveReference(reference, notes);
        if (!target || target.id === note.id) continue;
        const entry = resolved.get(target.id);
        if (entry) {
            entry.references.push(reference);
        } else {
            resolved.set(target.id, { note: target, references: [reference] });
        }
    }

    return [...resolved.values()];
}

export function findUnlinkedNoteMentions(note: Note, notes: readonly Note[]): UnlinkedNoteMention[] {
    return notes
        .filter((source) => source.id !== note.id && canRepairNoteConnections(source))
        .flatMap((source) => findMentionsInSource(source, [note]));
}

export function findMentionsInSource(note: Note, notes: readonly Note[]): UnlinkedNoteMention[] {
    const text = maskMarkdownNonText(note.content);
    const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)];
    const offsets: Array<{ from: number; to: number }> = [];
    const normalizedText = segments
        .map(({ segment, index }) => {
            const normalized = segment.normalize("NFC");
            for (let unit = 0; unit < normalized.length; unit += 1)
                offsets.push({ from: index, to: index + segment.length });
            return normalized;
        })
        .join("");
    const candidateNotes = notes.filter((candidate) => candidate.id !== note.id);
    const names = new Map<string, { display: string; candidates: Map<string, Note> }>();

    for (const candidate of candidateNotes) {
        for (const name of [candidate.title, ...getNoteAliases(candidate)]) {
            const normalized = name.trim().normalize("NFC").toLocaleLowerCase();
            if (!normalized) continue;
            const entry = names.get(normalized) ?? { display: name.trim(), candidates: new Map<string, Note>() };
            entry.candidates.set(candidate.id, candidate);
            names.set(normalized, entry);
        }
    }

    const matches: UnlinkedNoteMention[] = [];
    const occupied: Array<{ from: number; to: number }> = [];
    const orderedNames = [...names.values()].sort((a, b) => b.display.length - a.display.length);
    for (const entry of orderedNames) {
        const expression = new RegExp(
            `(?<![\\p{L}\\p{M}\\p{N}_])${escapeRegExp(entry.display.normalize("NFC"))}(?![\\p{L}\\p{M}\\p{N}_])`,
            "giu",
        );
        for (const match of normalizedText.matchAll(expression)) {
            const from = offsets[match.index]?.from;
            const to = offsets[match.index + match[0].length - 1]?.to;
            if (from === undefined || to === undefined) continue;
            if (occupied.some((range) => from < range.to && to > range.from)) continue;
            occupied.push({ from, to });
            matches.push({
                source: note,
                text: note.content.slice(from, to),
                from,
                to,
                excerpt: getTextExcerpt(note.content, from, to),
                candidates: [...entry.candidates.values()],
            });
        }
    }
    return matches.sort((a, b) => a.from - b.from);
}

export function findIncomingNoteLinks(note: Note, notes: readonly Note[]): IncomingNoteLink[] {
    const incoming: IncomingNoteLink[] = [];

    for (const source of notes) {
        if (source.id === note.id) continue;
        const reference = extractNoteLinkReferences(source.content).find(
            (candidate) => resolveReference(candidate, notes)?.id === note.id,
        );
        if (!reference) continue;
        incoming.push({ note: source, excerpt: getReferenceExcerpt(source.content, reference) });
    }

    return incoming;
}

function resolveReference(reference: NoteLinkReference, notes: readonly Note[]): Note | undefined {
    if (reference.kind === "id") return notes.find((candidate) => candidate.id === reference.target);
    const byId = notes.find((candidate) => candidate.id === reference.target);
    const candidates = findCompatibleNotes(notes, reference.target);
    return byId ?? (candidates.length === 1 ? candidates[0] : undefined);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml", "toml"]);

function maskMarkdownNonText(content: string, excludeLinks = true): string {
    const chars = content.split("");
    const mask = (from: number, to: number): void => {
        for (let index = from; index < to; index += 1) if (chars[index] !== "\n") chars[index] = " ";
    };
    const excluded = new Set([
        "code",
        "inlineCode",
        "html",
        "yaml",
        "toml",
        ...(excludeLinks ? ["link", "linkReference", "image", "imageReference", "definition"] : []),
    ]);
    const protectedHtml: Array<{ tag: string; from: number }> = [];
    visit(markdownParser.parse(content), (node, _index, parent) => {
        const from = node.position?.start.offset;
        const to = node.position?.end.offset;
        if (from === undefined || to === undefined) return;
        if (node.type === "html" && parent && !["root", "blockquote", "listItem"].includes(parent.type)) {
            const opening = node.value.match(/^<(a|code|pre)(?=[\s/>])/i)?.[1]?.toLowerCase();
            const closing = node.value.match(/^<\/(a|code|pre)(?=[\s>])/i)?.[1]?.toLowerCase();
            if (opening) protectedHtml.push({ tag: opening, from });
            if (closing) {
                const index = protectedHtml.findLastIndex((entry) => entry.tag === closing);
                const start = protectedHtml[index]?.from;
                if (start !== undefined) {
                    mask(start, to);
                    protectedHtml.splice(index);
                }
            }
        }
        if (excluded.has(node.type)) mask(from, to);
    });
    if (protectedHtml[0]) mask(protectedHtml[0].from, content.length);
    const visible = chars.join("");
    for (const pattern of excludeLinks ? [/!?\[\[[^\]\n]+\]\]/g, /\b(?:https?:\/\/|app:\/\/)[^\s<>]+/g] : []) {
        for (const match of visible.matchAll(pattern)) {
            if (match.index !== undefined) mask(match.index, match.index + match[0].length);
        }
    }
    return chars.join("");
}

function getTextExcerpt(content: string, from: number, to: number): string {
    const lineStart = content.lastIndexOf("\n", from) + 1;
    const lineEndAt = content.indexOf("\n", to);
    const lineEnd = lineEndAt < 0 ? content.length : lineEndAt;
    return (
        markdownLineToPlainText(content.slice(Math.max(lineStart, from - 60), Math.min(lineEnd, to + 90))) ||
        content.slice(from, to)
    );
}

function isAttachmentTarget(target: string): boolean {
    return (
        isImageAttachmentTarget(target) ||
        isVideoAttachmentTarget(target) ||
        isPdfAttachmentTarget(target) ||
        /\.(?:mp3|m4a|wav|flac|aac|opus|zip|gz|tar|csv|docx?|xlsx?|pptx?)$/i.test(target)
    );
}

function getReferenceExcerpt(content: string, reference: NoteLinkReference): string {
    const referenceIndex = content.indexOf(reference.raw);
    const lineStart = referenceIndex < 0 ? 0 : content.lastIndexOf("\n", referenceIndex) + 1;
    const lineEndIndex = content.indexOf("\n", Math.max(0, referenceIndex));
    const lineEnd = lineEndIndex < 0 ? content.length : lineEndIndex;
    const excerpt = markdownLineToPlainText(content.slice(lineStart, lineEnd), { includeWikiSubpath: true })
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/<[^>]*>/g, "")
        .replace(/>/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return excerpt.slice(0, 160) || reference.target;
}
