import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { queryNotes, queryTags, querySettings, queryProjects } from "../dist/lib/db.js";

const { DatabaseSync } = "Bun" in globalThis
    ? { DatabaseSync: (await import("bun:sqlite")).Database }
    : await import("node:sqlite");
const dir = mkdtempSync(join(tmpdir(), "writeme-cli-runtime-"));
const file = join(dir, "notes.sqlite");
try {
    const db = new DatabaseSync(file);
    try {
        db.exec(`
            CREATE TABLE notes (
                id TEXT, title TEXT, content TEXT, noteType TEXT, filePath TEXT,
                tags TEXT, project TEXT, createdAt INTEGER, updatedAt INTEGER,
                favorite INTEGER, url TEXT, description TEXT
            );
            CREATE TABLE hashtags (hashtag TEXT, filename TEXT);
            CREATE TABLE settings (name TEXT, value TEXT);
            CREATE TABLE projects (id TEXT, title TEXT, folderPath TEXT);
            INSERT INTO notes VALUES ('1', 'Runtime note', 'hello', 'note', '/note.md', '[]', NULL, 1, 1, 0, NULL, NULL);
            INSERT INTO hashtags VALUES ('test', '/note.md');
            INSERT INTO settings VALUES ('theme', 'dark');
            INSERT INTO projects VALUES ('p', 'Project', '/project');
        `);
    } finally {
        db.close();
    }
    assert.equal(queryNotes({ limit: 20 }, file)[0].title, "Runtime note");
    assert.equal(queryNotes({ limit: 20, tag: "test" }, file).length, 1);
    assert.equal(queryNotes({ limit: 20, search: "' OR 1=1 --" }, file).length, 0);
    assert.equal(queryTags({ note: "1" }, file)[0].hashtag, "test");
    assert.equal(queryTags({ note: "missing" }, file).length, 0);
    assert.equal(querySettings(file)[0].value, "dark");
    assert.equal(queryProjects(file)[0].id, "p");
    assert.throws(() => queryNotes({ limit: 20 }, join(dir, "missing.sqlite")));
    assert.equal(queryNotes({ limit: 20 }, file).length, 1);
    console.log("CLI SQLite runtime passed");
} finally {
    rmSync(dir, { recursive: true, force: true });
}
