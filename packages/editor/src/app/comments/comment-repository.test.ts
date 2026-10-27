import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCommentThreads } from "@/lib/note-comments";
import { Note } from "@/store/note";

const mocks = vi.hoisted(() => ({
    listNotes: vi.fn(),
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
            // the companion lookup reads note metadata only, never every file
            getRecentNotes: mocks.listNotes,
            getOne: mocks.getOne,
            save: mocks.save,
            updateContentIfUnchanged: mocks.update,
        },
    },
}));
vi.mock("@/store/settings", () => ({ SettingsService: { load: () => ({ directory: "/workspace" }) } }));
vi.mock("@/lib/storage-mode", () => ({ getStorageMode: () => mocks.storageMode }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => true }));
import { loadCommentNote, saveNoteComment } from "./comment-repository";

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
    mocks.listNotes.mockResolvedValue([]);
    mocks.stat.mockResolvedValue({ success: true, exists: false });
    mocks.write.mockResolvedValue({ success: true, fileSize: 100, lastModified: "2026-10-10T12:00:00Z" });
    mocks.save.mockImplementation(async (note: Note) => note);
});

const source = (): Note =>
    Note.parse({ ...Note.new("Advisor", "Some words."), filePath: "/workspace/plans/advisor.md" });

describe("comment persistence", () => {
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
        mocks.listNotes.mockResolvedValue([elsewhere, existing]);
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
        mocks.listNotes.mockResolvedValue([existing]);
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
