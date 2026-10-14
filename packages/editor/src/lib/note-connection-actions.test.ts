import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { applyConnectionRepair, createConnectionTarget, undoConnectionRepair } from "./note-connection-actions";

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
vi.mock("@/store/global.store", () => ({ globalDispatch: { syncNoteFromRepository: mocks.sync, notes: mocks.notes } }));
vi.mock("./note-link-repair", async (original) => ({
    ...(await original<typeof import("./note-link-repair")>()),
    requestNoteLinkRepair: mocks.repair,
}));

describe("connection actions", () => {
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
    it("does not overwrite a later edit when undoing", async () => {
        mocks.update.mockResolvedValue(null);
        await expect(undoConnectionRepair(source, "original")).rejects.toThrow("changed after linking");
    });
});
