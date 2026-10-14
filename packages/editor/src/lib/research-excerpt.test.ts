import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note, NoteType } from "@/store/note";
import {
    appendResearchExcerpt,
    captureResearchSelection,
    createResearchExcerpt,
    isResearchDestination,
    saveResearchExcerpt,
    type ResearchExcerptSource,
} from "./research-excerpt";

const source = Note.new("Book [draft]", "Original text", NoteType.pdf);
const pdf: ResearchExcerptSource = { kind: "pdf", note: source, page: 2, fingerprint: "asset-hash" };

describe("research excerpts", () => {
    beforeEach(() => {
        document.body.replaceChildren();
        window.getSelection()?.removeAllRanges();
    });

    it("retains literal quotation text, stable note identity, PDF page and asset identity", () => {
        const excerpt = createResearchExcerpt("A *literal* [phrase]\nSecond line", pdf, "action-1");
        expect(excerpt).toContain("> A \\*literal\\* \\[phrase\\]\n> Second line");
        expect(excerpt).toContain(`Open source](/note/${source.id}?research=1&excerpt=action-1&page=2&pdf=asset-hash)`);
        expect(excerpt).toContain("Book \\[draft\\], p. 2");
        expect(source.content).toBe("Original text");
    });

    it("keeps the original article URL and rejects empty text and unsafe original URLs", () => {
        const article = Note.new("Article", "body", NoteType["read-it-later"], "https://example.test/a?q=(b)");
        expect(createResearchExcerpt("text", { kind: "article", note: article }, "action-2")).toContain(
            "Original article](<https://example.test/a?q=(b)>)",
        );
        article.url = "javascript:alert(1)";
        expect(createResearchExcerpt("text", { kind: "article", note: article }, "action-2")).not.toContain(
            "javascript:",
        );
        expect(() => createResearchExcerpt("  ", pdf, "action-1")).toThrow("Select text");
    });

    it("appends multiple actions while making retries idempotent even after Markdown normalization", () => {
        const excerpt = createResearchExcerpt("first", pdf, "action-1");
        const first = appendResearchExcerpt("My writing\n", excerpt, "action-1");
        expect(first).toMatch(/^My writing\n\n> first/);
        expect(appendResearchExcerpt(first.replace("—", "-"), excerpt, "action-1")).toBe(first.replace("—", "-"));
        expect(appendResearchExcerpt(first, createResearchExcerpt("second", pdf, "action-2"), "action-2")).toContain(
            "> second",
        );
    });

    it("captures the selected PDF page and rejects unrelated or cross-source selections", () => {
        const page = document.createElement("div");
        page.className = "wm-pdf-page";
        page.dataset.researchSource = source.id;
        page.dataset.pdfPage = "3";
        const text = document.createElement("div");
        text.className = "wm-pdf-text-layer";
        text.textContent = "Selectable phrase";
        page.append(text);
        const other = document.createElement("div");
        other.textContent = "Unrelated text";
        document.body.append(page, other);
        const range = document.createRange();
        range.selectNodeContents(text);
        const selection = window.getSelection()!;
        selection.addRange(range);
        expect(captureResearchSelection(pdf, selection)).toMatchObject({ page: 3 });
        range.setEnd(other.firstChild!, 5);
        expect(captureResearchSelection(pdf, selection)).toBeNull();
        range.selectNodeContents(other);
        expect(captureResearchSelection(pdf, selection)).toBeNull();
        selection.removeAllRanges();
        expect(captureResearchSelection(pdf, selection)).toBeNull();
    });

    it("preserves a concurrent destination edit and recovers on retry", async () => {
        const destination = Note.new("Writing", "Before");
        const excerpt = createResearchExcerpt("text", pdf, "action-1");
        const repository = {
            getOne: vi.fn(async () => destination),
            updateContentIfUnchanged: vi.fn(
                async (
                    _id: string,
                    _expected: { title: string; updatedAt: Date; content: string },
                    content: string,
                ): Promise<Note | null> => {
                    destination.content = content;
                    return destination;
                },
            ),
        };
        repository.updateContentIfUnchanged.mockImplementationOnce(async () => {
            destination.content = "Concurrent writing";
            return null;
        });
        await expect(saveResearchExcerpt(repository, destination.id, excerpt, "action-1", source.id)).rejects.toThrow(
            "changed",
        );
        expect(destination.content).toBe("Concurrent writing");
        await saveResearchExcerpt(repository, destination.id, excerpt, "action-1", source.id);
        expect(destination.content).toMatch(/^Concurrent writing\n\n> text/);
        await saveResearchExcerpt(repository, destination.id, excerpt, "action-1", source.id);
        expect(repository.updateContentIfUnchanged).toHaveBeenCalledTimes(2);
    });

    it("rejects deleted, changed-format and self destinations", async () => {
        for (const type of [NoteType.pdf, NoteType.freehand, NoteType.task, NoteType.template]) {
            expect(isResearchDestination(Note.new("Structured", "", type), source.id)).toBe(false);
        }
        const destination = Note.new("Deleted", "");
        destination.deletedAt = new Date();
        const repository = { getOne: vi.fn(async () => destination), updateContentIfUnchanged: vi.fn() };
        await expect(saveResearchExcerpt(repository, destination.id, "excerpt", "action-1", source.id)).rejects.toThrow(
            "no longer available",
        );
        expect(repository.updateContentIfUnchanged).not.toHaveBeenCalled();
    });
});
