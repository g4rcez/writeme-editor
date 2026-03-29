import { describe, it, expect } from "vitest";
import { executeQuery, type DataSources } from "../engine";
import { parse } from "../parser";
import type { Note } from "@/store/note";
import { NoteType } from "@/store/note";

function makeNote(overrides: Partial<Note> & { id: string }): Note {
  return {
    type: "__writeme_note",
    title: "Untitled",
    content: "",
    project: "",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-06-01"),
    filePath: null,
    fileSize: 0,
    lastSynced: null,
    tags: [],
    createdBy: "user",
    updatedBy: "user",
    noteType: "note",
    url: null,
    description: null,
    favicon: null,
    metadata: {},
    favorite: false,
    ...overrides,
  } as Note;
}

const notes: Note[] = [
  makeNote({
    id: "1",
    title: "Dune",
    tags: ["book", "sci-fi"],
    metadata: { author: "Herbert", rating: 5 },
    favorite: true,
  }),
  makeNote({
    id: "2",
    title: "Clean Code",
    tags: ["book", "programming"],
    metadata: { author: "Martin", rating: 4 },
    noteType: NoteType.note,
  }),
  makeNote({
    id: "3",
    title: "Quick thought",
    noteType: NoteType.quick,
    tags: ["idea"],
  }),
  makeNote({
    id: "4",
    title: "Tolkien research",
    tags: ["book", "fantasy"],
    metadata: { author: "Tolkien", rating: 5 },
    content: "A story about the ring",
  }),
  makeNote({
    id: "5",
    title: "Meeting notes",
    createdAt: new Date("2023-01-15"),
  }),
];

const dataSources: DataSources = { notes };

describe("engine", () => {
  it("returns all notes for empty query", () => {
    const result = executeQuery(parse(""), dataSources);
    expect(result).toHaveLength(5);
  });

  it("filters by exact string equality", () => {
    const result = executeQuery(parse("WHERE title = 'Dune'"), dataSources);
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("1");
  });

  it("filters by string inequality", () => {
    const result = executeQuery(parse("WHERE title != 'Dune'"), dataSources);
    expect(result).toHaveLength(4);
  });

  it("filters by tags CONTAINS", () => {
    const result = executeQuery(
      parse("WHERE tags CONTAINS 'book'"),
      dataSources,
    );
    expect(result).toHaveLength(3);
  });

  it("filters by content CONTAINS", () => {
    const result = executeQuery(
      parse("WHERE content CONTAINS 'ring'"),
      dataSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("4");
  });

  it("filters by metadata field", () => {
    const result = executeQuery(
      parse("WHERE metadata.author = 'Herbert'"),
      dataSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("1");
  });

  it("filters by metadata numeric comparison", () => {
    const result = executeQuery(
      parse("WHERE metadata.rating >= 4"),
      dataSources,
    );
    expect(result).toHaveLength(3);
  });

  it("filters with AND", () => {
    const result = executeQuery(
      parse("WHERE tags CONTAINS 'book' AND metadata.rating >= 5"),
      dataSources,
    );
    expect(result).toHaveLength(2);
  });

  it("filters with OR", () => {
    const result = executeQuery(
      parse("WHERE noteType = 'quick' OR noteType = 'template'"),
      dataSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("3");
  });

  it("filters with NOT", () => {
    const result = executeQuery(
      parse("WHERE NOT favorite = true"),
      dataSources,
    );
    expect(result).toHaveLength(4);
  });

  it("filters by boolean", () => {
    const result = executeQuery(parse("WHERE favorite = true"), dataSources);
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("1");
  });

  it("filters by STARTS_WITH", () => {
    const result = executeQuery(
      parse("WHERE title STARTS_WITH 'Meet'"),
      dataSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("5");
  });

  it("filters by LIKE pattern", () => {
    const result = executeQuery(
      parse("WHERE title LIKE '%notes%'"),
      dataSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("5");
  });

  it("sorts ASC by title", () => {
    const result = executeQuery(parse("ORDER BY title ASC"), dataSources);
    expect(result[0]!["notes.title"]).toBe("Clean Code");
    expect(result[result.length - 1]!["notes.title"]).toBe("Tolkien research");
  });

  it("sorts DESC by metadata.rating", () => {
    const result = executeQuery(
      parse("WHERE tags CONTAINS 'book' ORDER BY metadata.rating DESC"),
      dataSources,
    );
    expect(
      (result[0]!["notes.metadata"] as Record<string, unknown>).rating,
    ).toBe(5);
    expect(
      (result[result.length - 1]!["notes.metadata"] as Record<string, unknown>)
        .rating,
    ).toBe(4);
  });

  it("limits results", () => {
    const result = executeQuery(parse("LIMIT 2"), dataSources);
    expect(result).toHaveLength(2);
  });

  it("filters by date comparison", () => {
    const result = executeQuery(
      parse("WHERE createdAt < '2024-01-01'"),
      dataSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.id"]).toBe("5");
  });

  it("handles null check", () => {
    const result = executeQuery(parse("WHERE filePath = null"), dataSources);
    expect(result).toHaveLength(5);
  });

  it("handles complex query", () => {
    const result = executeQuery(
      parse(
        "WHERE tags CONTAINS 'book' AND metadata.author != 'Martin' ORDER BY metadata.rating DESC LIMIT 2",
      ),
      dataSources,
    );
    expect(result).toHaveLength(2);
    result.forEach((row) => {
      expect(result[0]!["notes.tags"]).toContain("book");
      expect(
        (row["notes.metadata"] as Record<string, unknown>).author,
      ).not.toBe("Martin");
    });
  });
});

describe("engine - JOIN", () => {
  const hashtags = [
    {
      id: "h1",
      hashtag: "#sci-fi",
      filename: "1",
      project: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "h2",
      hashtag: "#programming",
      filename: "2",
      project: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "h3",
      hashtag: "#orphan",
      filename: "999",
      project: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const tabs = [
    {
      id: "t1",
      noteId: "1",
      order: 0,
      project: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "t2",
      noteId: "3",
      order: 1,
      project: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const joinSources: DataSources = { notes, hashtags, tabs };

  it("joins notes with hashtags", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename"),
      joinSources,
    );
    expect(result).toHaveLength(2);
    expect(result[0]!["notes.title"]).toBe("Dune");
    expect(result[0]!["hashtags.hashtag"]).toBe("#sci-fi");
  });

  it("filters joined results with WHERE", () => {
    const result = executeQuery(
      parse(
        "FROM notes JOIN hashtags ON notes.id = hashtags.filename WHERE notes.title = 'Dune'",
      ),
      joinSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["hashtags.hashtag"]).toBe("#sci-fi");
  });

  it("sorts joined results", () => {
    const result = executeQuery(
      parse(
        "FROM notes JOIN hashtags ON notes.id = hashtags.filename ORDER BY notes.title DESC",
      ),
      joinSources,
    );
    expect(result[0]!["notes.title"]).toBe("Dune");
    expect(result[1]!["notes.title"]).toBe("Clean Code");
  });

  it("limits joined results", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename LIMIT 1"),
      joinSources,
    );
    expect(result).toHaveLength(1);
  });

  it("handles multiple JOINs", () => {
    const result = executeQuery(
      parse(
        "FROM notes JOIN hashtags ON notes.id = hashtags.filename JOIN tabs ON notes.id = tabs.noteId",
      ),
      joinSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.title"]).toBe("Dune");
    expect(result[0]!["hashtags.hashtag"]).toBe("#sci-fi");
    expect(result[0]!["tabs.id"]).toBe("t1");
  });

  it("returns empty when no rows match the join", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename"),
      {
        notes,
        hashtags: [
          {
            id: "h1",
            hashtag: "#none",
            filename: "nonexistent",
            project: "",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    );
    expect(result).toHaveLength(0);
  });

  it("supports non-notes primary table", () => {
    const projects = [
      {
        id: "default",
        name: "My Project",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = executeQuery(
      parse("FROM projects JOIN tabs ON projects.id = tabs.project"),
      { projects, tabs },
    );
    expect(result).toHaveLength(2);
    expect(result[0]!["projects.name"]).toBe("My Project");
  });
});

describe("engine - GROUP BY", () => {
  const groupNotes = [
    makeNote({
      id: "1",
      title: "A",
      noteType: NoteType.note,
      fileSize: 100,
      favorite: true,
    }),
    makeNote({
      id: "2",
      title: "B",
      noteType: NoteType.note,
      fileSize: 200,
      favorite: false,
    }),
    makeNote({
      id: "3",
      title: "C",
      noteType: NoteType.quick,
      fileSize: 150,
      favorite: true,
    }),
    makeNote({
      id: "4",
      title: "D",
      noteType: NoteType.quick,
      fileSize: 50,
      favorite: false,
    }),
    makeNote({
      id: "5",
      title: "E",
      noteType: NoteType.note,
      fileSize: 300,
      favorite: true,
    }),
  ];
  const groupSources: DataSources = { notes: groupNotes };

  it("groups by noteType with COUNT(*)", () => {
    const result = executeQuery(
      parse(
        'SELECT noteType, COUNT(*) as "Total" FROM notes GROUP BY noteType',
      ),
      groupSources,
    );
    expect(result).toHaveLength(2);
    const noteRow = result.find((r) => r["notes.noteType"] === "note");
    const quickRow = result.find((r) => r["notes.noteType"] === "quick");
    expect(noteRow!["Total"]).toBe(3);
    expect(quickRow!["Total"]).toBe(2);
  });

  it("groups with SUM aggregate", () => {
    const result = executeQuery(
      parse("SELECT noteType, SUM(fileSize) FROM notes GROUP BY noteType"),
      groupSources,
    );
    const noteRow = result.find((r) => r["notes.noteType"] === "note");
    const quickRow = result.find((r) => r["notes.noteType"] === "quick");
    expect(noteRow!["SUM(fileSize)"]).toBe(600);
    expect(quickRow!["SUM(fileSize)"]).toBe(200);
  });

  it("groups with AVG aggregate", () => {
    const result = executeQuery(
      parse("SELECT noteType, AVG(fileSize) FROM notes GROUP BY noteType"),
      groupSources,
    );
    const noteRow = result.find((r) => r["notes.noteType"] === "note");
    expect(noteRow!["AVG(fileSize)"]).toBe(200);
  });

  it("groups with MIN and MAX aggregates", () => {
    const result = executeQuery(
      parse(
        "SELECT noteType, MIN(fileSize), MAX(fileSize) FROM notes GROUP BY noteType",
      ),
      groupSources,
    );
    const noteRow = result.find((r) => r["notes.noteType"] === "note");
    expect(noteRow!["MIN(fileSize)"]).toBe(100);
    expect(noteRow!["MAX(fileSize)"]).toBe(300);
  });

  it("groups with WHERE filter applied before grouping", () => {
    const result = executeQuery(
      parse(
        'SELECT noteType, COUNT(*) as "Total" FROM notes WHERE favorite = true GROUP BY noteType',
      ),
      groupSources,
    );
    expect(result).toHaveLength(2);
    const noteRow = result.find((r) => r["notes.noteType"] === "note");
    const quickRow = result.find((r) => r["notes.noteType"] === "quick");
    expect(noteRow!["Total"]).toBe(2);
    expect(quickRow!["Total"]).toBe(1);
  });

  it("supports ORDER BY on alias after GROUP BY", () => {
    const result = executeQuery(
      parse(
        "SELECT noteType, COUNT(*) as total FROM notes GROUP BY noteType ORDER BY total DESC",
      ),
      groupSources,
    );
    expect(result[0]!["total"]).toBe(3);
    expect(result[1]!["total"]).toBe(2);
  });

  it("handles aggregate without GROUP BY (implicit single group)", () => {
    const result = executeQuery(
      parse("SELECT COUNT(*) FROM notes"),
      groupSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["COUNT(*)"]).toBe(5);
  });

  it("handles COUNT(column) counting non-null values", () => {
    const notesWithNulls = [
      makeNote({ id: "1", title: "A", url: "http://a.com" }),
      makeNote({ id: "2", title: "B", url: null }),
      makeNote({ id: "3", title: "C", url: "http://c.com" }),
    ];
    const result = executeQuery(parse("SELECT COUNT(url) FROM notes"), {
      notes: notesWithNulls,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!["COUNT(url)"]).toBe(2);
  });

  it("GROUP BY without SELECT includes group columns and COUNT(*)", () => {
    const result = executeQuery(
      parse("FROM notes GROUP BY noteType"),
      groupSources,
    );
    expect(result).toHaveLength(2);
    result.forEach((row) => {
      expect(row).toHaveProperty("notes.noteType");
      expect(row).toHaveProperty("COUNT(*)");
    });
  });
});
