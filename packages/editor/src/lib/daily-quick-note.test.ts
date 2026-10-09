import { startOfDay } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note, NoteType } from "@/store/note";
import { getOrCreateDailyQuickNote } from "./daily-quick-note";

const mocks = vi.hoisted(() => ({
    isElectron: vi.fn(),
    loadSettings: vi.fn(),
    getQuicknoteByDate: vi.fn(),
    getOne: vi.fn(),
    save: vi.fn(),
}));

vi.mock("@/lib/is-electron", () => ({ isElectron: mocks.isElectron }));
vi.mock("@/store/settings", () => ({ SettingsService: { load: mocks.loadSettings } }));
vi.mock("@/store/repositories", () => ({
    repositories: {
        notes: {
            getQuicknoteByDate: mocks.getQuicknoteByDate,
            getOne: mocks.getOne,
            save: mocks.save,
        },
    },
}));

describe("getOrCreateDailyQuickNote", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isElectron.mockReturnValue(false);
        mocks.loadSettings.mockReturnValue({ directory: "/workspace" });
        mocks.getQuicknoteByDate.mockResolvedValue(null);
        mocks.getOne.mockResolvedValue(null);
        mocks.save.mockImplementation(async (note: Note) => note);
    });

    it("reuses one in-flight create request for the same day", async () => {
        let resolveLookup: (note: Note | null) => void = () => undefined;
        mocks.getQuicknoteByDate.mockImplementation(
            () => new Promise<Note | null>((resolve) => (resolveLookup = resolve)),
        );

        const date = new Date(2026, 4, 12, 15);
        const firstRequest = getOrCreateDailyQuickNote(date);
        const secondRequest = getOrCreateDailyQuickNote(new Date(2026, 4, 12, 22));
        resolveLookup(null);

        const [first, second] = await Promise.all([firstRequest, secondRequest]);

        expect(first).toBe(second);
        expect(first.noteType).toBe(NoteType.quick);
        expect(mocks.getQuicknoteByDate).toHaveBeenCalledOnce();
        expect(mocks.save).toHaveBeenCalledOnce();
    });

    it("applies a selected template only when creating a note", async () => {
        const note = await getOrCreateDailyQuickNote(new Date(2026, 4, 12), {
            title: "Daily review",
            content: "Template content",
        });

        expect(note.title).toBe("Daily review");
        expect(note.content).toBe("Template content");
        expect(mocks.save).toHaveBeenCalledWith(note);
    });

    it("leaves an existing daily note unchanged when a template is selected", async () => {
        const existing = Note.new("Today's note", "Existing user content", NoteType.quick);
        mocks.getQuicknoteByDate.mockResolvedValue(existing);

        const note = await getOrCreateDailyQuickNote(new Date(2026, 4, 12), {
            title: "Template title",
            content: "Template content",
        });

        expect(note).toBe(existing);
        expect(note.title).toBe("Today's note");
        expect(note.content).toBe("Existing user content");
        expect(mocks.save).not.toHaveBeenCalled();
    });

    it("uses separate notes for separate local days", async () => {
        await getOrCreateDailyQuickNote(new Date(2026, 4, 12, 23, 59));
        await getOrCreateDailyQuickNote(new Date(2026, 4, 13, 0, 1));

        expect(mocks.getQuicknoteByDate).toHaveBeenNthCalledWith(1, startOfDay(new Date(2026, 4, 12)));
        expect(mocks.getQuicknoteByDate).toHaveBeenNthCalledWith(2, startOfDay(new Date(2026, 4, 13)));
        expect(mocks.save).toHaveBeenCalledTimes(2);
    });

    it("does not overwrite an existing desktop note that cannot be read", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.getOne.mockResolvedValue(null);
        const writeFile = vi.fn();
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                db: { notes: { getByFilePath: vi.fn().mockResolvedValue({ id: "existing-note" }) } },
                fs: { writeFile },
            },
        });

        await expect(getOrCreateDailyQuickNote(new Date(2026, 4, 12))).rejects.toThrow(
            "The existing daily quick note could not be read. It was not changed.",
        );
        expect(writeFile).not.toHaveBeenCalled();
    });

    it("adopts a readable desktop file without replacing its content", async () => {
        mocks.isElectron.mockReturnValue(true);
        const writeFile = vi.fn();
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                db: { notes: { getByFilePath: vi.fn().mockResolvedValue(null) } },
                fs: {
                    statFile: vi.fn().mockResolvedValue({ success: true, exists: true }),
                    readFile: vi.fn().mockResolvedValue({
                        success: true,
                        content: "Keep this content",
                        fileSize: 18,
                        lastModified: "2026-05-12T12:00:00.000Z",
                    }),
                    writeFile,
                },
            },
        });

        const note = await getOrCreateDailyQuickNote(new Date(2026, 4, 12), { content: "Template" });

        expect(note.content).toBe("Keep this content");
        expect(writeFile).not.toHaveBeenCalled();
        expect(mocks.save).toHaveBeenCalledWith(note);
    });
});
