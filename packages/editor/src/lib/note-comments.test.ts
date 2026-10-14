import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import {
    appendNoteComment,
    commentSlug,
    createCommentStatusOperation,
    getCommentCompanion,
    getCommentId,
    parseCommentThreads,
    setCommentThreadStatus,
    uniqueCommentId,
} from "./note-comments";

describe("note comments", () => {
    it("keeps the source folder and prefixes the exact filename", () => {
        const source = Note.parse({ title: "Advisor", filePath: "/workspace/plans/advisor.md" });
        expect(getCommentCompanion(source)).toEqual({
            title: "comments_advisor",
            filePath: "/workspace/plans/comments_advisor.md",
            href: "./comments_advisor.md",
        });
        expect(getCommentCompanion(Note.new("plans/advisor.md", "")).title).toBe("plans/comments_advisor");
        expect(getCommentId("./comments_advisor.md#some-words", source)).toBe("some-words");
        expect(getCommentId("./other.md#some-words", source)).toBeNull();
    });

    it("uses unicode words as collision-safe slug IDs", () => {
        expect(commentSlug("Olá, advisor! Next step.")).toBe("ola-advisor-next-step");
        expect(commentSlug("中文 评论")).toBe("中文-评论");
        expect(uniqueCommentId("Some words", ["some-words", "some-words-2"])).toBe("some-words-3");
        expect(commentSlug("!!!")).toBe("comment");
    });

    it("appends multiple multiline comments to one section without changing other sections", () => {
        let content = appendNoteComment(
            "# Comments\n",
            "first-sentence",
            "First sentence.",
            "First comment\nMore details",
        );
        content = appendNoteComment(content, "second-sentence", "Second sentence.", "Another thread");
        content = appendNoteComment(content, "first-sentence", "First sentence.", "Reply");
        expect(parseCommentThreads(content)).toEqual([
            {
                id: "first-sentence",
                quote: "First sentence.",
                comments: ["First comment\nMore details", "Reply"],
                status: "unresolved",
                history: [],
            },
            {
                id: "second-sentence",
                quote: "Second sentence.",
                comments: ["Another thread"],
                status: "unresolved",
                history: [],
            },
        ]);
        expect(content.match(/## first-sentence/g)).toHaveLength(1);
    });

    it("does not treat fenced Markdown headings as thread boundaries", () => {
        const content =
            "# Comments\n\n## sentence\n\n> Sentence\n\n- Example:\n  ```md\n  ## not-a-thread\n  ```\n\n## another\n\n- Other comment\n";
        const updated = appendNoteComment(content, "sentence", "Sentence", "Reply");
        expect(parseCommentThreads(updated).map((thread) => thread.id)).toEqual(["sentence", "another"]);
        expect(parseCommentThreads(updated)[0]?.comments).toContain("Reply");
        expect(updated).toContain("## not-a-thread");
    });

    it("defaults older threads to unresolved and persists idempotent status history", () => {
        const legacy = "## words\n\n> Words\n\n- First\n";
        const resolved = setCommentThreadStatus(legacy, "words", "resolved", "resolve-1", "2026-10-14T12:00:00.000Z");
        expect(parseCommentThreads(resolved)[0]).toEqual({
            id: "words",
            quote: "Words",
            comments: ["First"],
            status: "resolved",
            history: [{ operationId: "resolve-1", status: "resolved", at: "2026-10-14T12:00:00.000Z" }],
        });
        expect(setCommentThreadStatus(resolved, "words", "resolved", "resolve-1")).toBe(resolved);
        const reopened = setCommentThreadStatus(
            resolved,
            "words",
            "unresolved",
            "reopen-1",
            "2026-10-14T12:01:00.000Z",
        );
        expect(parseCommentThreads(reopened)[0]).toMatchObject({
            comments: ["First"],
            status: "unresolved",
            history: [
                { operationId: "resolve-1", status: "resolved" },
                { operationId: "reopen-1", status: "unresolved" },
            ],
        });
        expect(() => setCommentThreadStatus(reopened, "missing", "resolved", "missing-1")).toThrow(
            "This comment thread no longer exists.",
        );
    });

    it("combines repeated sections with the same sentence ID without losing replies", () => {
        expect(parseCommentThreads("## words\n\n> Words\n\n- First\n\n## words\n\n> Words\n\n- Second\n")).toEqual([
            { id: "words", quote: "Words", comments: ["First", "Second"], status: "unresolved", history: [] },
        ]);
    });

    it("updates duplicate sections without treating fenced metadata as status", () => {
        const content =
            "## words\n\n> Words\n\n- First\n\n```html\n<!-- writeme-comment-status: unresolved -->\n```\n\n## other\n\n- Other\n\n## words\n\n<!-- writeme-comment-status: unresolved -->\n\n- Second\n";
        const updated = setCommentThreadStatus(content, "words", "resolved", "resolve-duplicates");
        expect(updated).toContain("```html\n<!-- writeme-comment-status: unresolved -->\n```");
        expect(parseCommentThreads(updated)[0]).toMatchObject({
            status: "resolved",
            history: [{ operationId: "resolve-duplicates" }],
        });
        expect(parseCommentThreads(updated)[0]?.comments).toContain("Second");
        expect(parseCommentThreads(updated)[1]?.comments).toEqual(["Other"]);
    });

    it("keeps bounded history, preserves replies, and ignores a replay after newer status", () => {
        let content = "## words\n\n- First\n";
        content = setCommentThreadStatus(content, "words", "resolved", "original-resolve");
        content = appendNoteComment(content, "words", "Words", "New reply");
        content = setCommentThreadStatus(content, "words", "unresolved", "reopen");
        expect(setCommentThreadStatus(content, "words", "resolved", "original-resolve")).toBe(content);
        for (let index = 0; index < 20; index++) {
            content = setCommentThreadStatus(
                content,
                "words",
                index % 2 === 0 ? "resolved" : "unresolved",
                `event-${index}`,
            );
        }
        expect(parseCommentThreads(content)[0]).toMatchObject({
            status: "unresolved",
            comments: ["First", "New reply"],
        });
        expect(parseCommentThreads(content)[0]?.history).toHaveLength(12);
    });

    it("ignores malformed history while preserving a readable legacy thread", () => {
        const content =
            '## words\n\n<!-- writeme-comment-history: {broken} -->\n<!-- writeme-comment-history: {"operationId":1,"status":"resolved","at":null} -->\n\n- First\n';
        expect(parseCommentThreads(content)[0]).toMatchObject({
            status: "unresolved",
            history: [],
            comments: ["First"],
        });
    });

    it("does not replay an expired receipt over newer status when retried with its original time", () => {
        let content = "## words\n\n- First\n";
        const originalTime = "2026-10-14T12:00:00.000Z";
        content = setCommentThreadStatus(content, "words", "resolved", "old-retry", originalTime);
        for (let index = 0; index < 20; index++) {
            content = setCommentThreadStatus(
                content,
                "words",
                index % 2 === 0 ? "unresolved" : "resolved",
                `new-${index}`,
                `2026-10-14T12:01:${String(index).padStart(2, "0")}.000Z`,
            );
        }
        content = setCommentThreadStatus(content, "words", "unresolved", "last-reopen", "2026-10-14T12:02:00.000Z");
        expect(parseCommentThreads(content)[0]?.history).toHaveLength(12);
        expect(setCommentThreadStatus(content, "words", "resolved", "old-retry", originalTime)).toBe(content);
    });

    it("orders fresh actions after a clock correction without rejuvenating expired retries", () => {
        let content = "## words\n\n- First\n";
        const fresh = (id: string, at: string) =>
            createCommentStatusOperation(parseCommentThreads(content)[0]!, id, at);
        const resolve = fresh("fast-clock-resolve", "2026-10-15T00:00:00.000Z");
        content = setCommentThreadStatus(content, "words", "resolved", resolve.id, resolve.at);
        const reopen = fresh("corrected-clock-reopen", "2026-10-14T00:00:00.000Z");
        content = setCommentThreadStatus(content, "words", "unresolved", reopen.id, reopen.at);
        expect(parseCommentThreads(content)[0]).toMatchObject({
            status: "unresolved",
            comments: ["First"],
            history: [
                { operationId: resolve.id, at: "2026-10-15T00:00:00.000Z" },
                { operationId: reopen.id, at: "2026-10-15T00:00:00.001Z" },
            ],
        });
        expect(setCommentThreadStatus(content, "words", "resolved", resolve.id, resolve.at)).toBe(content);
        for (let index = 0; index < 20; index++) {
            const operation = fresh(`corrected-${index}`, "2026-10-14T00:00:00.000Z");
            content = setCommentThreadStatus(
                content,
                "words",
                index % 2 === 0 ? "resolved" : "unresolved",
                operation.id,
                operation.at,
            );
        }
        expect(parseCommentThreads(content)[0]?.history).toHaveLength(12);
        expect(parseCommentThreads(content)[0]?.history.some((event) => event.operationId === resolve.id)).toBe(false);
        expect(setCommentThreadStatus(content, "words", "resolved", resolve.id, resolve.at)).toBe(content);
    });
    it.each(["First paragraph\n\nSecond paragraph", "Example:\n```md\n## Heading\n```", "- Nested bullet\nNext line"])(
        "preserves the comment body %j in its Markdown reference",
        (body) => {
            expect(parseCommentThreads(appendNoteComment("", "words", "Words", body))[0]?.comments).toEqual([body]);
        },
    );
});
