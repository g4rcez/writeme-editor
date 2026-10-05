import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "./dexie-db";
import { NotesRepository } from "./notes.repository";
const conditionalUpdateMocks = vi.hoisted(() => ({
    transaction: vi.fn(async (...args: unknown[]) => {
        const operation = args.at(-1);
        if (typeof operation !== "function") throw new Error("Missing transaction operation.");
        return operation();
    }),
    noteGet: vi.fn(),
    noteUpdate: vi.fn(),
    noteHistoryWhere: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
        between: vi.fn(() => ({
            last: vi.fn().mockResolvedValue(undefined),
        })),
    })),
    noteHistoryAdd: vi.fn(),
}));

// Mock chainable Dexie collection
const mockCollection = {
    reverse: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
};

// Mock the db module
vi.mock("./dexie-db", () => ({
    db: {
        transaction: conditionalUpdateMocks.transaction,
        notes: {
            get: conditionalUpdateMocks.noteGet,
            update: conditionalUpdateMocks.noteUpdate,
            where: vi.fn().mockReturnThis(),
            notEqual: vi.fn().mockReturnThis(),
            toArray: vi.fn(),
            orderBy: vi.fn(),
        },
        noteHistory: {
            where: conditionalUpdateMocks.noteHistoryWhere,
            add: conditionalUpdateMocks.noteHistoryAdd,
            bulkDelete: vi.fn(),
        },
    },
}));

describe("NotesRepository", () => {
    let repository: NotesRepository;

    beforeEach(() => {
        // @ts-ignore
        repository = new NotesRepository({});
        vi.clearAllMocks();
        (db.notes.where as any).mockReturnValue({
            notEqual: vi.fn().mockReturnValue({
                and: vi.fn().mockReturnValue({
                    toArray: vi.fn().mockImplementation(() => mockCollection.toArray()),
                }),
                toArray: vi.fn().mockImplementation(() => mockCollection.toArray()),
            }),
            toArray: vi.fn().mockImplementation(() => mockCollection.toArray()),
        });
    });

    describe("getRecentNotes", () => {
        it("should return notes sorted by updatedAt descending", async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

            const notes = [
                { id: "2", title: "New Note", updatedAt: now },
                { id: "3", title: "Mid Note", updatedAt: yesterday },
                { id: "1", title: "Old Note", updatedAt: twoDaysAgo },
            ];

            (mockCollection.toArray as any).mockResolvedValue(notes);

            const result = await repository.getRecentNotes();

            expect(db.notes.where).toHaveBeenCalledWith("noteType");
            expect(result).toHaveLength(3);
            expect(result[0]!.title).toBe("New Note");
        });

        it("should limit the number of results if a limit is provided", async () => {
            const notes = Array.from({ length: 10 }, (_, i) => ({
                id: `${i}`,
                title: `Note ${i}`,
                updatedAt: new Date(),
                noteType: "note",
            }));

            (mockCollection.toArray as any).mockResolvedValue(notes);

            const result = await repository.getRecentNotes(5);

            expect(result).toHaveLength(5);
        });
    });

    describe("updateContentIfUnchanged", () => {
        const baseNote = {
            id: "note-1",
            title: "Research",
            content: "# Current",
            updatedAt: new Date("2026-04-05T06:07:08.000Z"),
            createdAt: new Date("2026-02-01T00:00:00.000Z"),
            noteType: "note",
            tags: [],
        };
        const expected = {
            title: baseNote.title,
            updatedAt: baseNote.updatedAt,
            content: baseNote.content,
        };

        it.each([
            ["title", { ...expected, title: "Renamed" }],
            ["version", { ...expected, updatedAt: new Date("2026-04-05T06:07:09.000Z") }],
            ["Markdown", { ...expected, content: "# Changed elsewhere" }],
        ])("does not apply a proposal when its base %s differs", async (_field, staleExpected) => {
            conditionalUpdateMocks.noteGet.mockResolvedValue(baseNote);

            await expect(repository.updateContentIfUnchanged("note-1", staleExpected, "# Proposed")).resolves.toBeNull();
            expect(conditionalUpdateMocks.noteUpdate).not.toHaveBeenCalled();
        });

        it("returns the saved note only when the entire reviewed base matches", async () => {
            conditionalUpdateMocks.noteGet.mockResolvedValue(baseNote);
            conditionalUpdateMocks.noteUpdate.mockResolvedValue(1);

            const saved = await repository.updateContentIfUnchanged("note-1", expected, "# Proposed");

            expect(saved).toMatchObject({ id: "note-1", title: "Research", content: "# Proposed" });
            expect(conditionalUpdateMocks.noteUpdate).toHaveBeenCalledWith(
                "note-1",
                expect.objectContaining({ content: "# Proposed", fileSize: "# Proposed".length }),
            );
        });
    });
});
