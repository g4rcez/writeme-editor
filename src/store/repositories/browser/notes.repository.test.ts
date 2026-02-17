import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotesRepository } from "./notes.repository";
import { db } from "./dexie-db";

// Mock chainable Dexie collection
const mockCollection = {
  reverse: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: vi.fn(),
};

// Mock the db module
vi.mock("./dexie-db", () => ({
  db: {
    notes: {
      toArray: vi.fn(),
      orderBy: vi.fn(),
    },
  },
}));

describe("NotesRepository", () => {
  let repository: NotesRepository;

  beforeEach(() => {
    repository = new NotesRepository();
    vi.clearAllMocks();
    (db.notes.orderBy as any).mockReturnValue(mockCollection);
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

      expect(db.notes.orderBy).toHaveBeenCalledWith("updatedAt");
      expect(mockCollection.reverse).toHaveBeenCalled();
      expect(mockCollection.toArray).toHaveBeenCalled();
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe("New Note");
    });

    it("should limit the number of results if a limit is provided", async () => {
       const notes = Array.from({ length: 5 }, (_, i) => ({
            id: `${i}`,
            title: `Note ${i}`,
            updatedAt: new Date()
        }));

        (mockCollection.toArray as any).mockResolvedValue(notes);

        await repository.getRecentNotes(5);

        expect(mockCollection.limit).toHaveBeenCalledWith(5);
    });
  });
});