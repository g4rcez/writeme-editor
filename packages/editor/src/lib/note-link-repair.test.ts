import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { createExtensions } from "@/app/extensions";
import { formatNoteMention } from "./markdown-links";
import {
    NOTE_LINK_REPAIR_EVENT,
    requestNoteLinkRepair,
    registerNoteLinkRepairHandler,
    repairTiptapLink,
    type NoteLinkRepairRequest,
} from "./note-link-repair";
import { extractNoteLinkReferences } from "./note-links";

describe("rich text connection repair", () => {
    it.each([
        "[[missing#Heading|API_v2]]",
        "[API_v2](/note/missing)",
        String.raw`[bracket \[one\] and \*star\*](/note/missing)`,
        '[Old name](app://note/missing "writeme-mention:missing")',
        '[API_v2](/note/missing "writeme-mention:missing")',
        '[**Visible**](app://note/missing#Heading "tooltip")',
        "app://note/missing",
        "[API_v2][ref]\n\n[ref]: app://note/missing",
    ])("repairs only one %s occurrence through repeated undo, redo and reload", (link) => {
        const editor = new Editor({
            content: `${link}\n\n${link}\n\n### Keep  this`,
            extensions: createExtensions(() => "github-dark"),
            parseOptions: { preserveWhitespace: "full" },
        });
        let reloaded: Editor | undefined;
        try {
            const lastPosition = editor.state.doc.content.size - editor.state.doc.lastChild!.nodeSize;
            editor.commands.setNodeSelection(lastPosition);
            editor.commands.updateAttributes("heading", { textAlign: "right" });
            const before = editor.getMarkdown();
            const beforeJSON = editor.getJSON();
            const unrelated = editor.state.doc.child(2).toJSON();
            const reference = extractNoteLinkReferences(before).find(({ target }) => target === "missing")!;
            const replacement =
                reference.kind === "wiki"
                    ? `[[target#Heading|${reference.label}]]`
                    : reference.markdown
                      ? `[${reference.markdown.label}](/note/target${reference.subpath ?? ""}${reference.markdown.title ? ` "${reference.markdown.title}"` : ""})`
                      : formatNoteMention("target", reference.label, reference.subpath);
            expect(
                repairTiptapLink(editor, {
                    noteId: "source",
                    expectedContent: before,
                    from: reference.from,
                    to: reference.to,
                    replacement,
                    result: null,
                }),
            ).toBe("applied");
            const after = editor.getMarkdown();
            const afterJSON = editor.getJSON();
            expect(editor.state.doc.child(2).toJSON()).toEqual(unrelated);
            expect(after).toContain("Keep  this");
            expect(extractNoteLinkReferences(after).some(({ target }) => target === "missing")).toBe(true);
            expect(extractNoteLinkReferences(after).find(({ target }) => target === "target")?.label).toBe(
                reference.label,
            );
            for (let iteration = 0; iteration < 2; iteration++) {
                expect(editor.commands.undo()).toBe(true);
                expect(editor.getJSON()).toEqual(beforeJSON);
                expect(editor.getMarkdown()).toBe(before);
                expect(editor.commands.redo()).toBe(true);
                expect(editor.getJSON()).toEqual(afterJSON);
                expect(editor.getMarkdown()).toBe(after);
            }
            reloaded = new Editor({
                extensions: createExtensions(() => "github-dark"),
                parseOptions: { preserveWhitespace: "full" },
            });
            expect(reloaded.commands.setContent(after, { parseOptions: { preserveWhitespace: "full" } })).toBe(true);
            expect(reloaded.getMarkdown()).toBe(after);
            expect(reloaded.state.doc.child(2).textContent).toBe("Keep  this");
            expect(reloaded.state.doc.child(2).attrs.level).toBe(3);
        } finally {
            reloaded?.destroy();
            editor.destroy();
        }
    });
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
