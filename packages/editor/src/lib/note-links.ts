import type { Note } from "@/store/note";
import {
    isImageAttachmentTarget,
    isPdfAttachmentTarget,
    isVideoAttachmentTarget,
    parseObsidianLink,
} from "@/lib/obsidian-links";

export type NoteLinkReference = {
    kind: "id" | "wiki";
    raw: string;
    target: string;
};

export type ResolvedNoteLink = {
    note: Note;
    references: NoteLinkReference[];
};

export type IncomingNoteLink = {
    note: Note;
    excerpt: string;
};

type NoteIndex = {
    byId: Map<string, Note>;
    byTitle: Map<string, Note[]>;
    byPath: Map<string, Note[]>;
};

const WIKI_LINK_PATTERN = /!?\[\[[^\]\n]+\]\]/g;
const MENTION_LINK_PATTERN = /\[([^\]]+)\]\([^)]*"writeme-mention:([^"]+)"\)/g;
const APP_NOTE_LINK_PATTERN = /app:\/\/note\/([^\s<>"')\]]+)/g;

export function extractNoteLinkReferences(content: string): NoteLinkReference[] {
    const references = new Map<string, NoteLinkReference>();
    const add = (reference: NoteLinkReference): void => {
        references.set(`${reference.kind}:${reference.target}:${reference.raw}`, reference);
    };

    for (const match of content.matchAll(MENTION_LINK_PATTERN)) {
        const raw = match[0];
        const target = match[2];
        if (raw && target) add({ kind: "id", raw, target });
    }

    for (const match of content.matchAll(APP_NOTE_LINK_PATTERN)) {
        const raw = match[0];
        const target = match[1];
        if (raw && target) add({ kind: "id", raw, target });
    }

    for (const match of content.matchAll(WIKI_LINK_PATTERN)) {
        const raw = match[0];
        const link = raw ? parseObsidianLink(raw) : null;
        if (!raw || !link || !link.target || isAttachmentTarget(link.target)) continue;
        add({ kind: "wiki", raw, target: link.target });
    }

    return [...references.values()];
}

export function resolveNoteLinks(note: Note, notes: readonly Note[]): ResolvedNoteLink[] {
    const index = createNoteIndex(notes);
    const resolved = new Map<string, ResolvedNoteLink>();

    for (const reference of extractNoteLinkReferences(note.content)) {
        const target = resolveReference(reference, index);
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

export function findIncomingNoteLinks(note: Note, notes: readonly Note[]): IncomingNoteLink[] {
    const index = createNoteIndex(notes);
    const incoming: IncomingNoteLink[] = [];

    for (const source of notes) {
        if (source.id === note.id) continue;
        const reference = extractNoteLinkReferences(source.content).find(
            (candidate) => resolveReference(candidate, index)?.id === note.id,
        );
        if (!reference) continue;
        incoming.push({ note: source, excerpt: getReferenceExcerpt(source.content, reference) });
    }

    return incoming;
}

function createNoteIndex(notes: readonly Note[]): NoteIndex {
    const byId = new Map<string, Note>();
    const byTitle = new Map<string, Note[]>();
    const byPath = new Map<string, Note[]>();

    for (const note of notes) {
        byId.set(note.id, note);
        const titleMatches = byTitle.get(note.title) ?? [];
        titleMatches.push(note);
        byTitle.set(note.title, titleMatches);

        if (note.filePath) {
            const normalizedPath = normalizeNotePath(note.filePath);
            const pathMatches = byPath.get(normalizedPath) ?? [];
            pathMatches.push(note);
            byPath.set(normalizedPath, pathMatches);
        }
    }

    return { byId, byTitle, byPath };
}

function resolveReference(reference: NoteLinkReference, index: NoteIndex): Note | undefined {
    if (reference.kind === "id") return index.byId.get(reference.target);

    const byId = index.byId.get(reference.target);
    if (byId) return byId;

    const pathTarget = normalizeNotePath(reference.target);
    if (reference.target.includes("/") || /\.md$/i.test(reference.target)) {
        const pathMatches = [...index.byPath.entries()]
            .filter(([path]) => path === pathTarget || path.endsWith(`/${pathTarget}`))
            .flatMap(([, matches]) => matches);
        if (pathMatches.length === 1) return pathMatches[0];
        if (pathMatches.length > 1) return undefined;
    }

    const titleMatches = index.byTitle.get(reference.target) ?? [];
    return titleMatches.length === 1 ? titleMatches[0] : undefined;
}

function normalizeNotePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\.md$/i, "").replace(/^\//, "");
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
    const excerpt = content
        .slice(lineStart, lineEnd)
        .replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, "$1")
        .replace(
            /!?\[\[([^\]|]+)(?:([#^][^|\]]*))?(?:\|([^\]]+))?\]\]/g,
            (_match, target: string, subpath?: string, alias?: string) =>
                alias?.trim() || `${target.trim()}${subpath ?? ""}`,
        )
        .replace(/`{1,3}/g, "")
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/<[^>]*>/g, "")
        .replace(/[*_~>]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return excerpt.slice(0, 160) || reference.target;
}
