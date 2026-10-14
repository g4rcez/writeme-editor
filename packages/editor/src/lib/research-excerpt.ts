import { NoteType, type Note, type INoteRepository } from "@/store/note";

export type ResearchExcerptSource =
    | { kind: "pdf"; note: Note; page: number; fingerprint: string }
    | { kind: "article"; note: Note };

function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]<>()!#|~])/g, "\\$1");
}

export function isResearchDestination(note: Note, sourceId: string): boolean {
    return !note.deletedAt && note.id !== sourceId && [NoteType.note, NoteType.quick].includes(note.noteType);
}

export function createResearchExcerpt(text: string, source: ResearchExcerptSource, operationId: string): string {
    if (!text.trim()) throw new Error("Select text in the source before sending it to a note.");
    const quote = escapeMarkdown(text.trim())
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n");
    const params = new URLSearchParams({ research: "1", excerpt: operationId });
    if (source.kind === "pdf") {
        params.set("page", String(source.page));
        params.set("pdf", source.fingerprint);
    }
    const href = `/note/${encodeURIComponent(source.note.id)}?${params}`;
    const title = escapeMarkdown(source.note.title.replace(/\s+/g, " ") || (source.kind === "pdf" ? "PDF" : "Article"));
    const attribution = `${title}${source.kind === "pdf" ? `, p. ${source.page}` : ""} · [Open source](${href})`;
    const original =
        source.kind === "article" && /^https?:\/\//i.test(source.note.url ?? "")
            ? ` · [Original article](<${source.note.url!.replace(/[<>\s]/g, (char) => encodeURIComponent(char))}>)`
            : "";
    return `${quote}\n>\n> — ${attribution}${original}`;
}

export function appendResearchExcerpt(content: string, excerpt: string, operationId: string): string {
    if (content.includes(`excerpt=${encodeURIComponent(operationId)}`)) return content;
    const separator = !content || content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
    return `${content}${separator}${excerpt}\n`;
}

export async function saveResearchExcerpt(
    repository: Pick<INoteRepository, "getOne" | "updateContentIfUnchanged">,
    destinationId: string,
    excerpt: string,
    operationId: string,
    sourceId: string,
): Promise<Note> {
    const latest = await repository.getOne(destinationId);
    if (!latest || !isResearchDestination(latest, sourceId))
        throw new Error("That destination note is no longer available. Choose another note.");
    const content = appendResearchExcerpt(latest.content, excerpt, operationId);
    if (content === latest.content) return latest;
    const updated = await repository.updateContentIfUnchanged(destinationId, latest, content);
    if (!updated)
        throw new Error("That note changed while the excerpt was being added. Retry to keep its latest edits.");
    return updated;
}

export function captureResearchSelection(
    source: ResearchExcerptSource,
    selection: Selection | null,
): ResearchExcerptSource | null {
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return null;
    const element = (node: Node | null): Element | null =>
        node instanceof Element ? node : (node?.parentElement ?? null);
    const root = (node: Node | null): Element | null =>
        source.kind === "pdf"
            ? (element(node)?.closest(".wm-pdf-text-layer")?.closest(".wm-pdf-page") ?? null)
            : (element(node)?.closest(".ProseMirror, .cm-content")?.closest("[data-research-source]") ?? null);
    const start = root(selection.anchorNode);
    const end = root(selection.focusNode);
    if (!start || start !== end || start.getAttribute("data-research-source") !== source.note.id) return null;
    if (source.kind === "article") return source;
    const page = Number(start.getAttribute("data-pdf-page"));
    return Number.isInteger(page) && page > 0 ? { ...source, page } : null;
}
