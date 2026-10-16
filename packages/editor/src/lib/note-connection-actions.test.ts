import { Editor } from "@tiptap/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as GlobalStoreModule from "@/store/global.store";
import { createExtensions } from "@/app/extensions";
import { Note, NoteType } from "@/store/note";
import type * as NoteLinkRepairModule from "./note-link-repair";
import { applyConnectionRepair, createConnectionTarget, undoConnectionRepair } from "./note-connection-actions";
import { registerNoteLinkRepairHandler, repairTiptapLink } from "./note-link-repair";

const mocks = vi.hoisted(() => ({
    getAll: vi.fn(),
    getOne: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    sync: vi.fn(),
    notes: vi.fn(),
    repair: vi.fn(),
}));
vi.mock("@/store/repositories", () => ({
    repositories: {
        notes: { getAll: mocks.getAll, getOne: mocks.getOne, save: mocks.save, updateContentIfUnchanged: mocks.update },
    },
}));
vi.mock("@/store/global.store", async (original) => ({
    ...(await original<typeof GlobalStoreModule>()),
    globalDispatch: { syncNoteFromRepository: mocks.sync, notes: mocks.notes },
}));
vi.mock("./note-link-repair", async (original) => ({
    ...(await original<typeof NoteLinkRepairModule>()),
    requestNoteLinkRepair: mocks.repair,
}));

describe("connection actions", () => {
    it("rejects a source whose format changed after preview", async () => {
        mocks.getOne.mockImplementation(async (id: string) =>
            id === source.id ? Note.parse({ ...source, noteType: NoteType.json }) : target,
        );
        await expect(applyConnectionRepair(repair)).rejects.toThrow("source note changed");
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.repair).not.toHaveBeenCalled();
    });
    it.each(["../Outside", "%2e%2e/Outside", "Folder/../../Outside", "C:\\Outside"])(
        "rejects an escaping creation target %s before saving",
        async (title) => {
            mocks.getAll.mockResolvedValue([]);
            await expect(createConnectionTarget(title)).rejects.toThrow(/workspace/);
            expect(mocks.save).not.toHaveBeenCalled();
        },
    );

    it("creates vault-root references as relative names that resolve consistently", async () => {
        mocks.getAll.mockResolvedValue([]);
        const target = await createConnectionTarget("/Folder/New.md");
        expect(target.title).toBe("Folder/New");
    });
    const source = Note.parse({ id: "source", title: "Source", content: "Target twice Target" });
    const target = Note.parse({ id: "target", title: "Target" });
    const repair = { source, target, from: 0, to: 6, replacement: "[[target|Target]]" };
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.getOne.mockImplementation(async (id: string) => (id === source.id ? source : target));
        mocks.getAll.mockResolvedValue([source, target]);
        mocks.repair.mockReturnValue(null);
    });
    it("creates a missing target once for simultaneous actions and reuses an existing alias", async () => {
        mocks.getAll.mockResolvedValue([]);
        const [first, second] = await Promise.all([
            createConnectionTarget("Missing"),
            createConnectionTarget("Missing"),
        ]);
        expect(first.id).toBe(second.id);
        expect(mocks.save).toHaveBeenCalledTimes(1);
        mocks.getAll.mockResolvedValue([Note.parse({ ...target, metadata: { alias: "Alias" } })]);
        expect((await createConnectionTarget("Alias")).id).toBe(target.id);
        expect(mocks.save).toHaveBeenCalledTimes(1);
    });
    it("uses a conditional repository update for exactly one occurrence and allows conditional undo", async () => {
        const saved = Note.parse({ ...source, content: "[[target|Target]] twice Target" });
        mocks.update.mockResolvedValue(saved);
        expect(await applyConnectionRepair(repair)).toBe(saved);
        expect(mocks.update).toHaveBeenCalledWith(source.id, source, saved.content);
        expect(mocks.sync).toHaveBeenCalledWith(saved);
        mocks.getOne.mockResolvedValue(saved);
        await undoConnectionRepair(saved, source.content);
        expect(mocks.update).toHaveBeenLastCalledWith(saved.id, saved, source.content);
    });
    it.each(["source-edit", "source-delete", "target-rename", "target-delete"])(
        "preserves content during %s",
        async (race) => {
            mocks.getOne.mockImplementation(async (id: string) => {
                if (id === source.id)
                    return race === "source-delete"
                        ? null
                        : race === "source-edit"
                          ? Note.parse({ ...source, content: "My newer draft" })
                          : source;
                return race === "target-delete"
                    ? null
                    : race === "target-rename"
                      ? Note.parse({ ...target, title: "Renamed" })
                      : target;
            });
            await expect(applyConnectionRepair(repair)).rejects.toThrow(/changed|deleted/);
            expect(mocks.update).not.toHaveBeenCalled();
        },
    );
    it("preserves unsaved editor drafts and refreshes after a conditional write conflict", async () => {
        mocks.repair.mockReturnValue("conflict");
        await expect(applyConnectionRepair(repair)).rejects.toThrow("unsaved");
        expect(mocks.update).not.toHaveBeenCalled();
        mocks.repair.mockReturnValue(null);
        mocks.update.mockResolvedValue(null);
        await expect(applyConnectionRepair(repair)).rejects.toThrow("changed");
    });
    it("rejects repository undo when any open formatted replica has an unsaved draft", async () => {
        const actual = await vi.importActual<typeof NoteLinkRepairModule>("./note-link-repair");
        mocks.repair.mockImplementation(actual.requestNoteLinkRepair);
        const saved = Note.parse({ ...source, content: "[[target|Target]] twice Target" });
        const clean = new Editor({ content: saved.content, extensions: createExtensions(() => "github-dark") });
        saved.content = clean.getMarkdown();
        mocks.getOne.mockResolvedValue(saved);
        const dirty = new Editor({ content: saved.content, extensions: createExtensions(() => "github-dark") });
        dirty.commands.insertContent("My unsaved draft ");
        const draft = dirty.getJSON();
        const unregister = [clean, dirty].map((editor) =>
            registerNoteLinkRepairHandler({
                noteId: () => source.id,
                getContent: () => editor.getMarkdown(),
                isEditable: () => editor.isEditable,
                apply: (request) => repairTiptapLink(editor, request),
            }),
        );
        try {
            await expect(undoConnectionRepair(saved, source.content)).rejects.toThrow("unsaved changes");
            expect(mocks.update).not.toHaveBeenCalled();
            expect(mocks.sync).not.toHaveBeenCalled();
            expect(dirty.getJSON()).toEqual(draft);
            expect(clean.getMarkdown()).toBe(saved.content);
        } finally {
            unregister.forEach((dispose) => dispose());
            clean.destroy();
            dirty.destroy();
        }
    });
    it("routes clean open-source undo through an undoable editor transaction", async () => {
        const actual = await vi.importActual<typeof NoteLinkRepairModule>("./note-link-repair");
        mocks.repair.mockImplementation(actual.requestNoteLinkRepair);
        const editor = new Editor({
            content: "[[target|Target]] twice Target",
            extensions: createExtensions(() => "github-dark"),
        });
        const saved = Note.parse({ ...source, content: editor.getMarkdown() });
        mocks.getOne.mockResolvedValue(saved);
        const unregister = registerNoteLinkRepairHandler({
            noteId: () => source.id,
            getContent: () => editor.getMarkdown(),
            isEditable: () => editor.isEditable,
            apply: (request) => repairTiptapLink(editor, request),
        });
        try {
            await undoConnectionRepair(saved, source.content);
            expect(editor.getMarkdown()).toBe(source.content);
            expect(mocks.update).not.toHaveBeenCalled();
            expect(mocks.sync).not.toHaveBeenCalled();
            for (let iteration = 0; iteration < 2; iteration++) {
                expect(editor.commands.undo()).toBe(true);
                expect(editor.getMarkdown()).toBe(saved.content);
                expect(editor.commands.redo()).toBe(true);
                expect(editor.getMarkdown()).toBe(source.content);
            }
        } finally {
            unregister();
            editor.destroy();
        }
    });
    it("does not overwrite a later edit when undoing", async () => {
        mocks.update.mockResolvedValue(null);
        await expect(undoConnectionRepair(source, "original")).rejects.toThrow("changed after linking");
    });
});
