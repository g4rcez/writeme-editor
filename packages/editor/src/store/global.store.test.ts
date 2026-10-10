import { beforeEach, describe, expect, it, vi } from "vitest";
import { repositories, useGlobalStore } from "./global.store";
import { Note, NoteType } from "./note";

vi.mock("./repositories", () => ({
    repositories: {
        tabs: {
            getAll: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
            updateOrder: vi.fn(),
        },
        notes: {
            update: vi.fn(),
            getRecentNotes: vi.fn(),
            updateMetadata: vi.fn(),
        },
        projects: {
            getAll: vi.fn(),
        },
        terminalSessions: {
            getOne: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
    };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Global Store", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGlobalStore.dispatchers.notes([]);
        useGlobalStore.dispatchers.setNote(null);
    });

    it("preserves edits and the selected note when transcription metadata finishes saving", async () => {
        const meeting = Note.new("Meeting", "Draft", NoteType["meeting-note"]);
        const other = Note.new("Other note", "Other content");
        useGlobalStore.dispatchers.notes([meeting, other]);
        useGlobalStore.dispatchers.setNote(meeting);
        let finishSave = (): void => {};
        vi.mocked(repositories.notes.updateMetadata).mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finishSave = resolve;
                }),
        );
        const metadata = { transcript: ["A saved segment"] };
        const saving = useGlobalStore.dispatchers.updateNoteMetadata(meeting.id, metadata);
        const editedMeeting = Note.parse({ ...meeting, title: "Renamed meeting", content: "Updated draft" });
        useGlobalStore.dispatchers.notes([editedMeeting, other]);
        useGlobalStore.dispatchers.setNote(other);
        finishSave();
        await saving;

        const savedMeeting = useGlobalStore.getState().notes.find((note) => note.id === meeting.id);
        expect(savedMeeting?.title).toBe("Renamed meeting");
        expect(savedMeeting?.content).toBe("Updated draft");
        expect(savedMeeting?.metadata).toEqual(metadata);
        expect(useGlobalStore.getState().note?.id).toBe(other.id);
    });

    it("retains the existing transcript and exposes a metadata save failure", async () => {
        const meeting = Note.new("Meeting", "Draft", NoteType["meeting-note"]);
        meeting.metadata = { transcript: ["Existing transcript"] };
        useGlobalStore.dispatchers.notes([meeting]);
        useGlobalStore.dispatchers.setNote(meeting);
        vi.mocked(repositories.notes.updateMetadata).mockRejectedValueOnce(new Error("Storage unavailable"));

        await expect(useGlobalStore.dispatchers.updateNoteMetadata(meeting.id, {})).rejects.toThrow("Storage unavailable");
        expect(useGlobalStore.getState().note?.metadata).toEqual({ transcript: ["Existing transcript"] });
    });

    it("should have loadRecentNotes action", () => {
        expect(useGlobalStore.dispatchers.loadRecentNotes).toBeDefined();
    });

    it("should have addTab action", () => {
        expect(useGlobalStore.dispatchers.addTab).toBeDefined();
    });

    it("should have addTerminalTab action", () => {
        expect(useGlobalStore.dispatchers.addTerminalTab).toBeDefined();
    });
});
