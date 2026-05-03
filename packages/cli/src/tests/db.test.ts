import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import {
  queryNotes,
  queryProjects,
  querySettings,
  queryTags,
} from "../lib/db.ts";

const TEST_DB = path.join(os.tmpdir(), "writeme-cli-test.sqlite");

beforeAll(() => {
  const db = new Database(TEST_DB);

  db.prepare(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, type TEXT, title TEXT, project TEXT,
      filePath TEXT, tags TEXT, createdAt TEXT, updatedAt TEXT,
      content TEXT, noteType TEXT, favorite INTEGER DEFAULT 0,
      url TEXT, description TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS hashtags (
      id TEXT PRIMARY KEY, type TEXT, hashtag TEXT, filename TEXT, project TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY, type TEXT, name TEXT UNIQUE,
      value TEXT, createdAt TEXT, updatedAt TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, type TEXT, title TEXT,
      folderPath TEXT, description TEXT, createdAt TEXT, updatedAt TEXT
    )
  `).run();

  db.prepare(
    `INSERT OR REPLACE INTO notes
      (id, title, noteType, filePath, content, updatedAt, createdAt, favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("n1", "Test Note", "note", "/a.md", "hello", "2024-01-02", "2024-01-01", 0);

  db.prepare(
    `INSERT OR REPLACE INTO notes
      (id, title, noteType, filePath, content, updatedAt, createdAt, favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("n2", "Quick note", "quick", "/b.md", "quick", "2024-01-03", "2024-01-01", 0);

  db.prepare(
    `INSERT OR REPLACE INTO hashtags (id, hashtag, filename) VALUES (?, ?, ?)`,
  ).run("h1", "work", "/a.md");

  db.prepare(
    `INSERT OR REPLACE INTO settings (id, name, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
  ).run("s1", "theme", '"dark"', "2024-01-01", "2024-01-01");

  db.prepare(
    `INSERT OR REPLACE INTO projects (id, title, folderPath, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("p1", "My Project", "/proj", "desc", "2024-01-01", "2024-01-01");

  db.close();
});

describe("queryNotes", () => {
  test("returns all notes with limit", () => {
    const rows = queryNotes({ limit: 20 }, TEST_DB);
    expect(rows.length).toBe(2);
  });

  test("filters by type", () => {
    const rows = queryNotes({ limit: 20, type: "quick" }, TEST_DB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe("n2");
  });

  test("filters by tag via join", () => {
    const rows = queryNotes({ limit: 20, tag: "work" }, TEST_DB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe("n1");
  });

  test("filters by search term", () => {
    const rows = queryNotes({ limit: 20, search: "Test" }, TEST_DB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe("n1");
  });

  test("clamps limit at 1000", () => {
    const rows = queryNotes({ limit: 99999 }, TEST_DB);
    expect(rows.length).toBeLessThanOrEqual(1000);
  });
});

describe("queryTags", () => {
  test("returns all tags", () => {
    const rows = queryTags({}, TEST_DB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.hashtag).toBe("work");
  });
});

describe("querySettings", () => {
  test("returns all settings", () => {
    const rows = querySettings(TEST_DB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.name).toBe("theme");
  });
});

describe("queryProjects", () => {
  test("returns all projects", () => {
    const rows = queryProjects(TEST_DB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.title).toBe("My Project");
  });
});
