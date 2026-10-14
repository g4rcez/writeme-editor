import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCommentThreads } from "@/lib/note-comments";
import { Note } from "@/store/note";

const mocks = vi.hoisted(() => ({
    getAll: vi.fn(),
    getOne: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    stat: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    storageMode: "filesystem" as "filesystem" | "indexeddb",
}));
vi.mock("@/store/repositories", () => ({
    repositories: {
        notes: {
            getAll: mocks.getAll,
            getOne: mocks.getOne,
            save: mocks.save,
            updateContentIfUnchanged: mocks.update,
        },
    },
}));
vi.mock("@/store/settings", () => ({ SettingsService: { load: () => ({ directory: "/workspace" }) } }));
vi.mock("@/lib/storage-mode", () => ({ getStorageMode: () => mocks.storageMode }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => true }));
import { loadCommentNote, saveNoteComment, setNoteCommentStatus } from "./comment-repository";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.storageMode = "filesystem";
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: {
            fs: {
                statFile: mocks.stat,
                readFile: mocks.read,
                createFile: mocks.write,
                writeFile: vi.fn(() => {
                    throw new Error("Existing files must not be overwritten");
                }),
            },
        },
    });
    mocks.getAll.mockResolvedValue([]);
    mocks.stat.mockResolvedValue({ success: true, exists: false });
    mocks.write.mockResolvedValue({ success: true, fileSize: 100, lastModified: "2026-10-10T12:00:00Z" });
    mocks.save.mockImplementation(async (note: Note) => note);
});

const source = (): Note =>
    Note.parse({ ...Note.new("Advisor", "Some words."), filePath: "/workspace/plans/advisor.md" });

describe("comment persistence", () => {
    it("recovers a status file write after a metadata failure without replaying an old event", async () => {
        const original = source();
        let reference = Note.parse({
            ...Note.new("comments_advisor", "## words\n\n> Words\n\n- First\n"),
            filePath: "/workspace/plans/comments_advisor.md",
            metadata: { commentSourceId: original.id },
        });
        mocks.getAll.mockImplementation(async () => [original, reference]);
        mocks.getOne.mockImplementation(async (id: string) => (id === original.id ? original : reference));
        mocks.update.mockImplementationOnce(async (_id: string, _expected: unknown, content: string) => {
            reference = Note.parse({ ...reference, content });
            throw new Error("Metadata failed after file write");
        });
        await expect(setNoteCommentStatus(original, "words", "resolved", "partial-resolve")).rejects.toThrow(
            "Metadata failed",
        );
        mocks.update.mockImplementation(async (_id: string, _expected: unknown, content: string) => {
            reference = Note.parse({ ...reference, content });
            return reference;
        });
        await setNoteCommentStatus(original, "words", "unresolved", "newer-reopen");
        const recovered = await setNoteCommentStatus(original, "words", "resolved", "partial-resolve");
        expect(parseCommentThreads(recovered.content)[0]).toMatchObject({ status: "unresolved", comments: ["First"] });
        expect(parseCommentThreads(recovered.content)[0]?.history).toHaveLength(2);
        expect(mocks.update).toHaveBeenCalledTimes(2);
    });

    it("rejects stale status writes and deleted sources", async () => {
        const original = source();
        const reference = Note.parse({
            ...Note.new("comments_advisor", "## words\n\n- First\n"),
            metadata: { commentSourceId: original.id },
        });
        mocks.getAll.mockResolvedValue([reference]);
        mocks.getOne.mockImplementation(async (id: string) => (id === original.id ? original : reference));
        mocks.update.mockResolvedValue(null);
        await expect(setNoteCommentStatus(original, "words", "resolved", "stale-resolve")).rejects.toThrow(
            "comments note changed",
        );
        mocks.getOne.mockResolvedValue(null);
        await expect(setNoteCommentStatus(original, "words", "resolved", "deleted-resolve")).rejects.toThrow(
            "source note was deleted",
        );
    });
    it("uses the desktop notes repository when no folder is configured", async () => {
        mocks.storageMode = "indexeddb";
        const result = await saveNoteComment(Note.new("Advisor", "Some words."), "Some words.", "Comment", null, []);
        expect(mocks.save).toHaveBeenCalledWith(result.note);
        expect(result.note.filePath).toBeNull();
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it("writes the exact companion filename in the source directory", async () => {
        const result = await saveNoteComment(source(), "Some words.", "Comment", null, []);
        expect(mocks.write).toHaveBeenCalledWith(
            "/workspace/plans/comments_advisor.md",
            expect.stringContaining("## some-words"),
        );
        expect(result.note.filePath).toBe("/workspace/plans/comments_advisor.md");
        expect(result.note.content).toContain("(./advisor.md)");
    });

    it("reuses the sibling file and preserves all threads while appending a reply", async () => {
        const existing = Note.parse({
            ...Note.new("comments_advisor", "# Comments\n\n## some-words\n\n> Some words.\n\n- Original\n"),
            filePath: "/workspace/plans/comments_advisor.md",
        });
        const elsewhere = Note.parse({
            ...existing,
            id: "other",
            filePath: "/workspace/elsewhere/comments_advisor.md",
        });
        mocks.getAll.mockResolvedValue([elsewhere, existing]);
        mocks.getOne.mockResolvedValue(existing);
        mocks.update.mockImplementation(async (_id: string, _expected: unknown, content: string) =>
            Note.parse({ ...existing, content }),
        );
        const result = await saveNoteComment(source(), "Some words.", "Reply", "some-words", []);
        expect(mocks.getOne).toHaveBeenCalledWith(existing.id);
        expect(mocks.update).toHaveBeenCalledWith(
            existing.id,
            expect.objectContaining({ content: existing.content }),
            expect.any(String),
        );
        expect(parseCommentThreads(result.note.content)[0]?.comments).toEqual(["Original", "Reply"]);
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it("imports an existing companion file without overwriting it", async () => {
        mocks.stat.mockResolvedValue({ success: true, exists: true });
        mocks.read.mockResolvedValue({
            success: true,
            content: "# Existing comments",
            lastModified: "2026-10-10T12:00:00Z",
        });
        const loaded = await loadCommentNote(source());
        expect(loaded?.content).toBe("# Existing comments");
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it("surfaces filesystem failures and concurrent edits", async () => {
        mocks.write.mockResolvedValue({ success: false, error: "Permission denied" });
        await expect(saveNoteComment(source(), "Words", "Comment", null, [])).rejects.toThrow("Permission denied");
        expect(mocks.save).not.toHaveBeenCalled();
        const existing = Note.parse({
            ...Note.new("comments_advisor", "Original"),
            filePath: "/workspace/plans/comments_advisor.md",
        });
        mocks.getAll.mockResolvedValue([existing]);
        mocks.getOne.mockResolvedValue(existing);
        mocks.update.mockResolvedValue(null);
        await expect(saveNoteComment(source(), "Words", "Comment", null, [])).rejects.toThrow("comments note changed");
    });

    it("recovers a file committed before metadata failed without appending twice", async () => {
        const note = source();
        mocks.save.mockRejectedValueOnce(new Error("Snapshot failed"));
        await expect(
            saveNoteComment(note, "Words", "Only once", null, [], undefined, "retry-metadata"),
        ).rejects.toThrow("Snapshot failed");
        const content = mocks.write.mock.calls[0]![1] as string;
        mocks.read.mockResolvedValue({ success: true, content });
        const result = await saveNoteComment(note, "Words", "Only once", null, [], undefined, "retry-metadata");
        expect(parseCommentThreads(result.note.content)[0]?.comments).toEqual(["Only once"]);
        expect(mocks.write).toHaveBeenCalledTimes(1);
    });
});
