import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../../settings";
import { NotesRepository } from "./notes.repository";

const get = vi.fn();
const getAll = vi.fn();
const save = vi.fn();
const hardDelete = vi.fn();
const getTrashed = vi.fn();
const getRecentNotes = vi.fn();
const deleteFile = vi.fn();
const readDirRecursive = vi.fn();
const readFile = vi.fn();
const tabs = { deleteByNoteId: vi.fn() };

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SettingsService, "load").mockReturnValue({
        directory: "/notes",
    } as never);
    Object.defineProperty(window, "process", {
        configurable: true,
        value: { type: "renderer" },
    });
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: {
            db: {
                get,
                getAll,
                save,
                notes: { hardDelete, getTrashed, getRecentNotes },
            },
            fs: { deleteFile, readDirRecursive, readFile },
        },
    });
});

describe("Electron NotesRepository", () => {
    it("indexes every Markdown workspace file, including MDX files", async () => {
        getAll.mockResolvedValue([]);
        readDirRecursive.mockResolvedValue({
            success: true,
            files: [
                { name: "guide.md", path: "/notes/guide.md", relativePath: "guide.md" },
                { name: "component.mdx", path: "/notes/component.mdx", relativePath: "component.mdx" },
                { name: "image.txt", path: "/notes/image.txt", relativePath: "image.txt" },
            ],
        });
        readFile.mockImplementation(async (filePath: string) => ({
            success: true,
            content: filePath.endsWith(".mdx") ? "# Component\nReact notes" : "# Guide\nSearchable text",
            fileSize: 24,
            lastModified: "2026-01-01T00:00:00.000Z",
        }));

        const repository = new NotesRepository(tabs as never);
        const notes = await repository.getAll();

        expect(notes.map((note) => note.filePath)).toEqual(["/notes/guide.md", "/notes/component.mdx"]);
        expect(notes.map((note) => note.content)).toEqual(["# Guide\nSearchable text", "# Component\nReact notes"]);
        expect(save).toHaveBeenCalledTimes(2);
        expect(readFile).toHaveBeenCalledTimes(2);
    });

    it("hydrates indexed workspace notes with current file contents", async () => {
        const metadata = {
            id: "guide",
            title: "Guide",
            filePath: "/notes/guide.md",
            fileSize: 1,
            lastSynced: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
        };
        getAll.mockResolvedValue([metadata]);
        readDirRecursive.mockResolvedValue({
            success: true,
            files: [{ name: "guide.md", path: "/notes/guide.md", relativePath: "guide.md" }],
        });
        readFile.mockResolvedValue({
            success: true,
            content: "find me in the file",
            fileSize: 19,
            lastModified: "2026-01-01T00:00:00.000Z",
        });

        const repository = new NotesRepository(tabs as never);
        const [note] = await repository.getAll();

        expect(note?.id).toBe("guide");
        expect(note?.content).toBe("find me in the file");
        expect(note?.updatedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
        expect(save).toHaveBeenCalledWith(
            "notes",
            expect.objectContaining({ id: "guide", fileSize: 19, lastSynced: new Date("2026-01-01T00:00:00.000Z") }),
        );
    });

    it("keeps recent-note IPC requests within the 10,000 row limit", async () => {
        getRecentNotes.mockResolvedValue([]);
        const repository = new NotesRepository(tabs as never);

        await repository.getRecentNotes();
        await repository.getRecentNotes(50_000);

        expect(getRecentNotes).toHaveBeenNthCalledWith(1, 10_000, "/notes");
        expect(getRecentNotes).toHaveBeenNthCalledWith(2, 10_000, "/notes");
    });

    it("retains metadata when deleting the note file fails", async () => {
        get.mockResolvedValue({
            id: "failed",
            filePath: "/notes/.trash/failed.md",
        });
        deleteFile.mockRejectedValue(new Error("locked"));
        const repository = new NotesRepository(tabs as never);

        await expect(repository.hardDelete("failed")).resolves.toBe(false);

        expect(hardDelete).not.toHaveBeenCalled();
        expect(tabs.deleteByNoteId).not.toHaveBeenCalled();
    });

    it("leaves failed trash rows retryable while removing successful rows", async () => {
        const rows = [
            { id: "ok", filePath: "/notes/.trash/ok.md" },
            { id: "failed", filePath: "/notes/.trash/failed.md" },
        ];
        getTrashed.mockResolvedValue(rows);
        get.mockImplementation(async (_table: string, id: string) => rows.find((row) => row.id === id));
        deleteFile.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, error: "locked" });
        const repository = new NotesRepository(tabs as never);

        await expect(repository.emptyTrash()).resolves.toEqual({ deleted: 1, failed: 1 });

        expect(hardDelete).toHaveBeenCalledTimes(1);
        expect(hardDelete).toHaveBeenCalledWith("ok");
    });

    it("keeps failed age-purge rows and deletes them on retry", async () => {
        const row = {
            id: "retry",
            filePath: "/notes/.trash/retry.md",
            deletedAt: "2026-01-01T00:00:00.000Z",
        };
        getTrashed.mockResolvedValue([row]);
        get.mockResolvedValue(row);
        deleteFile.mockResolvedValueOnce({ success: false, error: "locked" }).mockResolvedValueOnce({ success: true });
        const repository = new NotesRepository(tabs as never);

        await expect(repository.purgeBefore(new Date("2026-02-01T00:00:00.000Z"))).resolves.toEqual({
            deleted: 0,
            failed: 1,
        });
        expect(hardDelete).not.toHaveBeenCalled();

        await repository.hardDelete(row.id);
        expect(hardDelete).toHaveBeenCalledWith(row.id);
    });
});
