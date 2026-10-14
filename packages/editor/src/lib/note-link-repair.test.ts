import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { createExtensions } from "@/app/extensions";
import {
    NOTE_LINK_REPAIR_EVENT,
    requestNoteLinkRepair,
    registerNoteLinkRepairHandler,
    repairTiptapLink,
    type NoteLinkRepairRequest,
} from "./note-link-repair";

describe("rich text connection repair", () => {
    it("preserves a dirty replica through the actual shared editor registration", () => {
        const clean = new Editor({ content: "Target", extensions: createExtensions(() => "github-dark") });
        const dirty = new Editor({
            content: "My newer draft mentions Target",
            extensions: createExtensions(() => "github-dark"),
        });
        const before = clean.getMarkdown();
        const draft = dirty.getMarkdown();
        const unregister = [clean, dirty].map((editor) =>
            registerNoteLinkRepairHandler({
                noteId: () => "source",
                getContent: () => editor.getMarkdown(),
                isEditable: () => editor.isEditable,
                apply: (request) => repairTiptapLink(editor, request),
            }),
        );
        try {
            expect(
                requestNoteLinkRepair({
                    noteId: "source",
                    expectedContent: before,
                    from: 0,
                    to: 6,
                    replacement: "[[target]]",
                }),
            ).toBe("conflict");
            expect(clean.getMarkdown()).toBe(before);
            expect(dirty.getMarkdown()).toBe(draft);
        } finally {
            unregister.forEach((dispose) => dispose());
            clean.destroy();
            dirty.destroy();
        }
    });
    it("checks every open source editor before allowing any editor to mutate", () => {
        const write = vi.fn();
        const cleanEditor = (event: Event): void => {
            const request = (event as CustomEvent<NoteLinkRepairRequest & { checkOnly?: boolean }>).detail;
            if (request.checkOnly) request.result ??= "applied";
            else {
                write();
                request.result = "applied";
            }
        };
        const dirtyEditor = (event: Event): void => {
            (event as CustomEvent<NoteLinkRepairRequest>).detail.result = "conflict";
        };
        window.addEventListener(NOTE_LINK_REPAIR_EVENT, cleanEditor);
        window.addEventListener(NOTE_LINK_REPAIR_EVENT, dirtyEditor);
        try {
            expect(
                requestNoteLinkRepair({
                    noteId: "source",
                    expectedContent: "Target",
                    from: 0,
                    to: 6,
                    replacement: "[[target]]",
                }),
            ).toBe("conflict");
            expect(write).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener(NOTE_LINK_REPAIR_EVENT, cleanEditor);
            window.removeEventListener(NOTE_LINK_REPAIR_EVENT, dirtyEditor);
        }
    });
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
