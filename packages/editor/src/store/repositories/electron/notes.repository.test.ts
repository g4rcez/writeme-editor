import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note, NoteType } from "../../note";
import { SettingsService } from "../../settings";
import { NotesRepository } from "./notes.repository";

const get = vi.fn();
const getAll = vi.fn();
const save = vi.fn();
const hardDelete = vi.fn();
const getTrashed = vi.fn();
const getRecentNotes = vi.fn();
const getHistory = vi.fn();
const saveSnapshot = vi.fn();
const updateContent = vi.fn();
const deleteFile = vi.fn();
const readDirRecursive = vi.fn();
const readFile = vi.fn();
const updateContentIfUnchanged = vi.fn();
const compareAndWriteFile = vi.fn();
const isCliEditorFile = vi.fn();
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
                notes: {
                    hardDelete,
                    getTrashed,
                    getRecentNotes,
                    getHistory,
                    saveSnapshot,
                    updateContent,
                    updateContentIfUnchanged,
                },
            },
            fs: { deleteFile, readDirRecursive, readFile, compareAndWriteFile },
            app: { isCliEditorFile },
        },
    });
});

describe("Electron NotesRepository", () => {
    it("finds database daily notes by journal date instead of last edit date", async () => {
        vi.spyOn(SettingsService, "load").mockReturnValue({ directory: null } as never);
        const note = Note.new("Retrospective", "Keep my review", NoteType.quick);
        note.metadata.journalDate = "2025-12-31";
        getRecentNotes.mockResolvedValue([note]);
        get.mockResolvedValue(note);
        const repository = new NotesRepository(tabs as never);
        expect((await repository.getQuicknoteByDate(new Date(2025, 11, 31)))?.id).toBe(note.id);
        expect(await repository.getQuicknoteByDate(new Date(2026, 0, 1))).toBeNull();
        note.deletedAt = new Date();
        expect(await repository.getQuicknoteByDate(new Date(2025, 11, 31))).toBeNull();
    });
    it("finds a readable renamed daily note only within the selected workspace", async () => {
        const elsewhere = Note.new("Other workspace", "Do not open", NoteType.quick);
        elsewhere.filePath = "/other/review.md";
        elsewhere.metadata.journalDate = "2025-12-31";
        const local = Note.new("Renamed review", "", NoteType.quick);
        local.filePath = "/notes/archive/review.md";
        local.metadata.journalDate = "2025-12-31";
        // the SQL behind getRecentNotes only returns notes inside the workspace
        getRecentNotes.mockImplementation(async (_limit: number, workspace: string | null) =>
            [elsewhere, local].filter((note) => !workspace || !note.filePath || note.filePath.startsWith(`${workspace}/`)),
        );
        get.mockImplementation(async (_collection: string, id: string) => (id === local.id ? local : elsewhere));
        readDirRecursive.mockResolvedValue({
            success: true,
            files: [{ name: "review.md", path: local.filePath, relativePath: "archive/review.md" }],
        });
        readFile.mockResolvedValue({
            success: true,
            content: "Preserved review",
            lastModified: "2026-01-01T00:00:00Z",
        });
        const daily = await new NotesRepository(tabs as never).getQuicknoteByDate(new Date(2025, 11, 31));
        expect(daily?.id).toBe(local.id);
        expect(daily?.content).toBe("Preserved review");
        // only the matching file was read; the workspace was not scanned
        expect(readFile).toHaveBeenCalledTimes(1);
        expect(readDirRecursive).not.toHaveBeenCalled();
    });

    it("rejects an unreadable renamed daily note instead of returning empty content", async () => {
        const note = Note.new("Review", "", NoteType.quick);
        note.filePath = "/notes/review.md";
        note.metadata.journalDate = "2025-12-31";
        getRecentNotes.mockResolvedValue([note]);
        get.mockResolvedValue(note);
        readDirRecursive.mockResolvedValue({
            success: true,
            files: [{ name: "review.md", path: note.filePath, relativePath: "review.md" }],
        });
        readFile.mockResolvedValue({ success: false, error: "Permission denied" });
        await expect(new NotesRepository(tabs as never).getQuicknoteByDate(new Date(2025, 11, 31))).rejects.toThrow(
            "The existing daily quick note could not be read. It was not changed.",
        );
        expect(save).not.toHaveBeenCalled();
    });
    it("imports a task Markdown file as a board", async () => {
        getAll.mockResolvedValue([]);
        readDirRecursive.mockResolvedValue({
            success: true,
            files: [{ name: "tasks.md", path: "/notes/tasks.md", relativePath: "tasks.md" }],
        });
        readFile.mockResolvedValue({
            success: true,
            content: "---\ntype: task\n---\n\n## Todo\n\n- [ ] Ship board\n",
            fileSize: 55,
            lastModified: "2026-01-01T00:00:00.000Z",
        });
        const notes = await new NotesRepository(tabs as never).getAll();
        expect(notes[0]?.noteType).toBe("task");
        expect(notes[0]?.content).toContain("- [ ] Ship board");
    });
    it("indexes Markdown and LaTeX workspace files without changing their source", async () => {
        getAll.mockResolvedValue([]);
        readDirRecursive.mockResolvedValue({
            success: true,
            files: [
                { name: "guide.md", path: "/notes/guide.md", relativePath: "guide.md" },
                { name: "component.mdx", path: "/notes/component.mdx", relativePath: "component.mdx" },
                { name: "paper.tex", path: "/notes/paper.tex", relativePath: "paper.tex" },
                { name: "appendix.latex", path: "/notes/appendix.latex", relativePath: "appendix.latex" },
                { name: "image.txt", path: "/notes/image.txt", relativePath: "image.txt" },
            ],
        });
        readFile.mockImplementation(async (filePath: string) => {
            let content = "# Guide\nSearchable text";
            if (filePath.endsWith(".mdx")) {
                content = "# Component\nReact notes";
            } else if (filePath.endsWith(".tex")) {
                content = "\\documentclass{article}\n\\begin{document}\n$ x^2 $\n\\end{document}\n";
            } else if (filePath.endsWith(".latex")) {
                content = "\\section*{Appendix}\n\\newcommand{\\R}{\\mathbb{R}}\n";
            }
            return {
                success: true,
                content,
                fileSize: 24,
                lastModified: "2026-01-01T00:00:00.000Z",
            };
        });

        const repository = new NotesRepository(tabs as never);
        const notes = await repository.getAll();

        expect(notes.map((note) => note.filePath)).toEqual([
            "/notes/guide.md",
            "/notes/component.mdx",
            "/notes/paper.tex",
            "/notes/appendix.latex",
        ]);
        expect(notes.map((note) => note.content)).toEqual([
            "# Guide\nSearchable text",
            "# Component\nReact notes",
            "\\documentclass{article}\n\\begin{document}\n$ x^2 $\n\\end{document}\n",
            "\\section*{Appendix}\n\\newcommand{\\R}{\\mathbb{R}}\n",
        ]);
        expect(save).toHaveBeenCalledTimes(4);
        expect(saveSnapshot).toHaveBeenCalledTimes(4);
        expect(readFile).toHaveBeenCalledTimes(4);
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

    it("keeps workspace notes and excludes sibling or traversal paths when a scan fails", async () => {
        const timestamp = new Date("2026-01-01T00:00:00.000Z");
        const metadata = (id: string, filePath: string) => ({
            id,
            title: id,
            content: "# Note",
            filePath,
            updatedAt: timestamp,
            createdAt: timestamp,
            noteType: "note",
        });
        getAll.mockResolvedValue([
            metadata("workspace-note", "/notes/guide.md"),
            metadata("sibling-note", "/notes-private/secret.md"),
            metadata("traversal-note", "/notes/../outside.md"),
        ]);
        readDirRecursive.mockRejectedValueOnce(new Error("workspace unavailable"));
        const repository = new NotesRepository(tabs as never);

        const notes = await repository.getAll();

        expect(notes.map((note) => note.id)).toEqual(["workspace-note"]);
        expect(readFile).not.toHaveBeenCalled();
    });
    it("keeps recent-note IPC requests within the 10,000 row limit", async () => {
        getRecentNotes.mockResolvedValue([]);
        const repository = new NotesRepository(tabs as never);

        await repository.getRecentNotes();
        await repository.getRecentNotes(50_000);

        expect(getRecentNotes).toHaveBeenNthCalledWith(1, 10_000, "/notes");
        expect(getRecentNotes).toHaveBeenNthCalledWith(2, 10_000, "/notes");
    });

    it("restores a snapshot through the normal content update path", async () => {
        getHistory.mockResolvedValue([
            {
                id: "snapshot-1",
                noteId: "note-1",
                content: "restored content",
                createdAt: "2026-01-01T00:00:00.000Z",
            },
        ]);
        get.mockResolvedValue({ id: "note-1", title: "Note", content: "current content" });
        updateContent.mockResolvedValue(true);
        const repository = new NotesRepository(tabs as never);

        await repository.restoreSnapshot("note-1", "snapshot-1");

        expect(updateContent).toHaveBeenCalledWith(
            "note-1",
            "restored content",
            "restored content".length,
            expect.any(String),
            undefined,
        );
    });
    it("saves database-backed CLI editor changes to the authorized source file", async () => {
        const timestamp = new Date("2026-10-01T12:00:00.000Z");
        const note = Note.parse({
            id: "cli-prompt",
            title: "Claude prompt",
            content: "Original prompt",
            filePath: "/tmp/claude-prompt.md",
            updatedAt: timestamp,
        });
        vi.spyOn(SettingsService, "load").mockReturnValue({ directory: null } as never);
        get.mockResolvedValue(note);
        isCliEditorFile.mockResolvedValue(true);
        compareAndWriteFile.mockResolvedValue({
            success: true,
            fileSize: 28,
            lastModified: "2026-10-01T12:01:00.000Z",
        });
        updateContentIfUnchanged.mockResolvedValue({
            ...note,
            content: "Updated prompt from Writeme.",
        });

        const result = await new NotesRepository(tabs as never).updateContentIfUnchanged(
            note.id,
            { title: note.title, updatedAt: timestamp, content: note.content },
            "Updated prompt from Writeme.",
        );

        expect(compareAndWriteFile).toHaveBeenCalledWith(
            note.filePath,
            "Original prompt",
            "Updated prompt from Writeme.",
        );
        expect(updateContentIfUnchanged).toHaveBeenCalledWith(
            note.id,
            { title: note.title, updatedAt: timestamp.toISOString(), content: note.content },
            "Updated prompt from Writeme.",
            expect.any(String),
            undefined,
        );
        expect(result).toMatchObject({
            content: "Updated prompt from Writeme.",
            filePath: note.filePath,
            fileSize: 28,
            lastSynced: new Date("2026-10-01T12:01:00.000Z"),
        });
    });

    it("does not update CLI note metadata when its source file changed concurrently", async () => {
        const timestamp = new Date("2026-10-01T12:00:00.000Z");
        const note = Note.parse({
            id: "cli-prompt",
            title: "Claude prompt",
            content: "Original prompt",
            filePath: "/tmp/claude-prompt.md",
            updatedAt: timestamp,
        });
        vi.spyOn(SettingsService, "load").mockReturnValue({ directory: null } as never);
        get.mockResolvedValue(note);
        isCliEditorFile.mockResolvedValue(true);
        compareAndWriteFile.mockResolvedValue({
            success: false,
            stale: true,
            error: "Note content changed since review.",
        });

        await expect(
            new NotesRepository(tabs as never).updateContentIfUnchanged(
                note.id,
                { title: note.title, updatedAt: timestamp, content: note.content },
                "Updated prompt from Writeme.",
            ),
        ).resolves.toBeNull();

        expect(updateContentIfUnchanged).not.toHaveBeenCalled();
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

describe("Electron NotesRepository workspace loading", () => {
    const file = (name: string) => ({ name, path: `/notes/${name}`, relativePath: name });
    const onDisk = (...names: string[]) => readDirRecursive.mockResolvedValue({ success: true, files: names.map(file) });
    const content = (text: string) => ({ success: true, content: text, lastModified: "2026-01-01T00:00:00Z", fileSize: text.length });
    const indexed = (name: string) => {
        const note = Note.new(name.replace(/\.md$/, ""), "");
        note.filePath = `/notes/${name}`;
        return note;
    };

    it("limits the result without scanning the workspace", async () => {
        const recent = [indexed("a.md"), indexed("b.md")];
        getRecentNotes.mockResolvedValue(recent);
        get.mockImplementation(async (_collection: string, id: string) => recent.find((note) => note.id === id));
        readFile.mockResolvedValue(content("hello"));

        const notes = await new NotesRepository(tabs as never).getAll({ limit: 2 });

        expect(notes.map((note) => note.content)).toEqual(["hello", "hello"]);
        expect(readDirRecursive).not.toHaveBeenCalled();
        expect(readFile).toHaveBeenCalledTimes(2);
        expect(getRecentNotes).toHaveBeenCalledWith(2, "/notes");
    });

    it("never reads more than 16 files at once when scanning a large workspace", async () => {
        const names = Array.from({ length: 80 }, (_, index) => `note-${index}.md`);
        onDisk(...names);
        getAll.mockResolvedValue([]);
        let running = 0;
        let peak = 0;
        readFile.mockImplementation(async () => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 1));
            running -= 1;
            return content("text");
        });

        await new NotesRepository(tabs as never).getAll();

        expect(readFile).toHaveBeenCalledTimes(80);
        expect(peak).toBeLessThanOrEqual(16);
    });

    it("loads only the added files and drops the removed ones when syncing a directory change", async () => {
        const kept = indexed("kept.md");
        const removed = indexed("removed.md");
        onDisk("kept.md", "added.md");
        getAll.mockResolvedValue([]);
        readFile.mockResolvedValue(content("brand new"));

        const synced = await new NotesRepository(tabs as never).syncWorkspaceDelta([kept, removed]);

        expect(readFile).toHaveBeenCalledTimes(1);
        expect(readFile).toHaveBeenCalledWith("/notes/added.md");
        expect(synced?.map((note) => note.filePath).toSorted()).toEqual(["/notes/added.md", "/notes/kept.md"]);
        expect(synced?.find((note) => note.filePath === "/notes/kept.md")).toBe(kept);
    });

    it("keeps notes that do not live in the workspace when syncing", async () => {
        const standalone = Note.new("Standalone", "stays");
        onDisk();
        const synced = await new NotesRepository(tabs as never).syncWorkspaceDelta([standalone]);
        expect(synced).toEqual([standalone]);
        expect(readFile).not.toHaveBeenCalled();
    });

    it("reports that it cannot sync when the workspace cannot be listed or is not a folder", async () => {
        readDirRecursive.mockResolvedValue({ success: false, error: "denied" });
        expect(await new NotesRepository(tabs as never).syncWorkspaceDelta([])).toBeNull();

        vi.spyOn(SettingsService, "load").mockReturnValue({ directory: null } as never);
        expect(await new NotesRepository(tabs as never).syncWorkspaceDelta([])).toBeNull();
    });
});
