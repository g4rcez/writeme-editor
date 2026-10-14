import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createExtensions } from "@/app/extensions";
import { repairTiptapLink } from "./note-link-repair";

describe("rich text connection repair", () => {
    it("preserves surrounding content, emits updates, and supports undo and redo", () => {
        const editor = new Editor({
            content: "First Target and Target.\n\n**Keep this.**",
            extensions: createExtensions(() => "github-dark"),
        });
        try {
            const before = editor.getMarkdown();
            const from = before.indexOf("Target");
            let updates = 0;
            editor.on("update", () => updates++);
            expect(
                repairTiptapLink(editor, {
                    noteId: "source",
                    expectedContent: before,
                    from,
                    to: from + 6,
                    replacement: '[Target](/note/target "writeme-mention:target")',
                    result: null,
                }),
            ).toBe("applied");
            expect(editor.getMarkdown()).toContain('[Target](/note/target "writeme-mention:target") and Target.');
            expect(editor.getMarkdown()).toContain("**Keep this.**");
            expect(updates).toBe(1);
            expect(editor.commands.undo()).toBe(true);
            expect(editor.getMarkdown()).toBe(before);
            expect(editor.commands.redo()).toBe(true);
            expect(editor.getMarkdown()).toContain("writeme-mention:target");
        } finally {
            editor.destroy();
        }
    });
});
