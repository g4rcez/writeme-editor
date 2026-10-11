import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import {
    appendNoteComment,
    commentSlug,
    getCommentCompanion,
    getCommentId,
    parseCommentThreads,
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
            { id: "first-sentence", quote: "First sentence.", comments: ["First comment\nMore details", "Reply"] },
            { id: "second-sentence", quote: "Second sentence.", comments: ["Another thread"] },
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

    it("combines repeated sections with the same sentence ID without losing replies", () => {
        expect(parseCommentThreads("## words\n\n> Words\n\n- First\n\n## words\n\n> Words\n\n- Second\n")).toEqual([
            { id: "words", quote: "Words", comments: ["First", "Second"] },
        ]);
    });

    it.each(["First paragraph\n\nSecond paragraph", "Example:\n```md\n## Heading\n```", "- Nested bullet\nNext line"])(
        "preserves the comment body %j in its Markdown reference",
        (body) => {
            expect(parseCommentThreads(appendNoteComment("", "words", "Words", body))[0]?.comments).toEqual([body]);
        },
    );
});
