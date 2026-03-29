import { describe, it, expect } from "vitest";
import { parse } from "../parser";
import { ParseError } from "../ast";

describe("parser", () => {
  it("parses empty string as empty query", () => {
    const q = parse("");
    expect(q).toEqual({
      type: "Query",
      select: null,
      from: null,
      joins: [],
      where: null,
      groupBy: null,
      orderBy: null,
      limit: null,
    });
  });

  it("parses simple WHERE equality", () => {
    const q = parse("WHERE title = 'Hello'");
    expect(q.where).toMatchObject({
      type: "Comparison",
      field: { type: "Column", path: ["title"] },
      op: "=",
      value: { type: "String", value: "Hello" },
    });
  });

  it("parses metadata dot notation", () => {
    const q = parse("WHERE metadata.author = 'Tolkien'");
    expect(q.where).toMatchObject({
      type: "Comparison",
      field: { type: "Column", path: ["metadata", "author"] },
      op: "=",
      value: { type: "String", value: "Tolkien" },
    });
  });

  it("parses CONTAINS operator", () => {
    const q = parse("WHERE tags CONTAINS 'book'");
    expect(q.where).toMatchObject({
      type: "Comparison",
      op: "CONTAINS",
      value: { type: "String", value: "book" },
    });
  });

  it("parses AND condition", () => {
    const q = parse("WHERE title = 'A' AND favorite = true");
    expect(q.where).toMatchObject({
      type: "BinaryLogical",
      op: "AND",
    });
  });

  it("parses OR condition", () => {
    const q = parse("WHERE noteType = 'note' OR noteType = 'quick'");
    expect(q.where).toMatchObject({
      type: "BinaryLogical",
      op: "OR",
    });
  });

  it("parses NOT condition", () => {
    const q = parse("WHERE NOT favorite = true");
    expect(q.where).toMatchObject({
      type: "UnaryLogical",
      op: "NOT",
    });
  });

  it("parses parenthesized groups", () => {
    const q = parse("WHERE (title = 'A' OR title = 'B') AND favorite = true");
    expect(q.where).toMatchObject({
      type: "BinaryLogical",
      op: "AND",
      left: { type: "Group" },
    });
  });

  it("parses ORDER BY ASC", () => {
    const q = parse("WHERE title = 'A' ORDER BY createdAt ASC");
    expect(q.orderBy).toMatchObject({
      type: "OrderBy",
      column: { path: ["createdAt"] },
      direction: "ASC",
    });
  });

  it("parses ORDER BY DESC", () => {
    const q = parse("ORDER BY updatedAt DESC");
    expect(q.orderBy).toMatchObject({
      direction: "DESC",
    });
  });

  it("parses LIMIT", () => {
    const q = parse("LIMIT 10");
    expect(q.limit).toBe(10);
  });

  it("parses SELECT with columns", () => {
    const q = parse("SELECT title, metadata.author WHERE title = 'A'");
    expect(q.select).toMatchObject({
      type: "Select",
      columns: [{ path: ["title"] }, { path: ["metadata", "author"] }],
    });
  });

  it("parses SELECT * as empty columns", () => {
    const q = parse("SELECT * WHERE title = 'A'");
    expect(q.select).toMatchObject({ type: "Select", columns: [] });
  });

  it("parses numeric values", () => {
    const q = parse("WHERE metadata.rating >= 4");
    expect(q.where).toMatchObject({
      type: "Comparison",
      op: ">=",
      value: { type: "Number", value: 4 },
    });
  });

  it("parses boolean values", () => {
    const q = parse("WHERE favorite = true");
    expect(q.where).toMatchObject({
      value: { type: "Boolean", value: true },
    });
  });

  it("parses null value", () => {
    const q = parse("WHERE filePath = null");
    expect(q.where).toMatchObject({
      value: { type: "Null" },
    });
  });

  it("throws ParseError on invalid input", () => {
    expect(() => parse("WHERE !!!")).toThrow(ParseError);
  });

  it("throws ParseError on incomplete expression", () => {
    expect(() => parse("WHERE title =")).toThrow(ParseError);
  });

  it("parses FROM notes (ignored)", () => {
    const q = parse("WHERE title = 'test' ORDER BY createdAt DESC LIMIT 5");
    expect(q.limit).toBe(5);
    expect(q.orderBy?.direction).toBe("DESC");
  });

  it("parses FROM and stores table name", () => {
    const q = parse("SELECT * FROM notes WHERE title = 'A'");
    expect(q.from).toBe("notes");
    expect(q.joins).toEqual([]);
  });

  it("parses JOIN clause", () => {
    const q = parse(
      "SELECT notes.title, hashtags.hashtag FROM notes JOIN hashtags ON notes.id = hashtags.filename",
    );
    expect(q.from).toBe("notes");
    expect(q.joins).toHaveLength(1);
    expect(q.joins[0]).toMatchObject({
      type: "Join",
      table: "hashtags",
      on: {
        type: "JoinCondition",
        left: { type: "Column", path: ["notes", "id"] },
        right: { type: "Column", path: ["hashtags", "filename"] },
      },
    });
  });

  it("parses INNER JOIN as synonym for JOIN", () => {
    const q = parse("FROM notes INNER JOIN tabs ON notes.id = tabs.noteId");
    expect(q.joins).toHaveLength(1);
    expect(q.joins[0]!.table).toBe("tabs");
  });

  it("parses multiple JOINs", () => {
    const q = parse(
      "FROM notes JOIN hashtags ON notes.id = hashtags.filename JOIN tabs ON notes.id = tabs.noteId",
    );
    expect(q.joins).toHaveLength(2);
    expect(q.joins[0]!.table).toBe("hashtags");
    expect(q.joins[1]!.table).toBe("tabs");
  });

  it("defaults from to null when absent", () => {
    const q = parse("WHERE title = 'test'");
    expect(q.from).toBeNull();
    expect(q.joins).toEqual([]);
  });

  it("parses SELECT column with AS string alias", () => {
    const q = parse('SELECT title as "Title", noteType as "Type" FROM notes');
    expect(q.select!.columns).toHaveLength(2);
    expect(q.select!.columns[0]).toMatchObject({
      path: ["title"],
      alias: "Title",
    });
    expect(q.select!.columns[1]).toMatchObject({
      path: ["noteType"],
      alias: "Type",
    });
  });

  it("parses SELECT column with AS identifier alias", () => {
    const q = parse("SELECT notes.title as NoteTitle FROM notes");
    expect(q.select!.columns[0]).toMatchObject({
      path: ["notes", "title"],
      alias: "NoteTitle",
    });
  });

  it("parses SELECT columns mixing aliased and non-aliased", () => {
    const q = parse('SELECT id, title as "Name", tags FROM notes');
    expect(q.select!.columns).toHaveLength(3);
    expect(q.select!.columns[0]!.alias).toBeUndefined();
    expect(q.select!.columns[1]!.alias).toBe("Name");
    expect(q.select!.columns[2]!.alias).toBeUndefined();
  });

  it("parses GROUP BY single column", () => {
    const q = parse("SELECT noteType FROM notes GROUP BY noteType");
    expect(q.groupBy).toHaveLength(1);
    expect(q.groupBy![0]).toMatchObject({ path: ["noteType"] });
  });

  it("parses GROUP BY multiple columns", () => {
    const q = parse("FROM notes GROUP BY noteType, project");
    expect(q.groupBy).toHaveLength(2);
    expect(q.groupBy![0]).toMatchObject({ path: ["noteType"] });
    expect(q.groupBy![1]).toMatchObject({ path: ["project"] });
  });

  it("parses SELECT with COUNT(*)", () => {
    const q = parse(
      'SELECT noteType, COUNT(*) as "Total" FROM notes GROUP BY noteType',
    );
    expect(q.select!.columns).toHaveLength(2);
    expect(q.select!.columns[0]).toMatchObject({
      type: "Column",
      path: ["noteType"],
    });
    expect(q.select!.columns[1]).toMatchObject({
      type: "Aggregate",
      fn: "COUNT",
      column: null,
      alias: "Total",
    });
  });

  it("parses SELECT with SUM/AVG/MIN/MAX", () => {
    const q = parse(
      "SELECT SUM(fileSize), AVG(fileSize), MIN(fileSize), MAX(fileSize) FROM notes",
    );
    expect(q.select!.columns).toHaveLength(4);
    expect(q.select!.columns[0]).toMatchObject({
      type: "Aggregate",
      fn: "SUM",
    });
    expect(q.select!.columns[1]).toMatchObject({
      type: "Aggregate",
      fn: "AVG",
    });
    expect(q.select!.columns[2]).toMatchObject({
      type: "Aggregate",
      fn: "MIN",
    });
    expect(q.select!.columns[3]).toMatchObject({
      type: "Aggregate",
      fn: "MAX",
    });
  });

  it("parses aggregate with table-prefixed column", () => {
    const q = parse("SELECT COUNT(notes.id) FROM notes");
    const agg = q.select!.columns[0]!;
    expect(agg).toMatchObject({
      type: "Aggregate",
      fn: "COUNT",
      column: { path: ["notes", "id"] },
    });
  });

  it("parses case-insensitive aggregate functions", () => {
    const q = parse("SELECT count(*) FROM notes");
    expect(q.select!.columns[0]).toMatchObject({
      type: "Aggregate",
      fn: "COUNT",
    });
  });

  it("parses GROUP BY with WHERE and ORDER BY", () => {
    const q = parse(
      "SELECT noteType, COUNT(*) as total FROM notes WHERE favorite = true GROUP BY noteType ORDER BY total DESC",
    );
    expect(q.where).toBeTruthy();
    expect(q.groupBy).toHaveLength(1);
    expect(q.orderBy).toMatchObject({ direction: "DESC" });
  });

  it("defaults groupBy to null when absent", () => {
    const q = parse("WHERE title = 'test'");
    expect(q.groupBy).toBeNull();
  });
});
