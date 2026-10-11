import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorkspaceReader } from "../src/reader";

const cleanup: string[] = [];
afterEach(async () => {
    for (const dir of cleanup.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function fixture(): Promise<{
    dir: string;
    workspace: string;
    db: Database;
}> {
    const dir = await mkdtemp(path.join(tmpdir(), "mcp-reader-test-"));
    cleanup.push(dir);
    const workspace = path.join(dir, "workspace");
    await mkdir(workspace);
    const db = new Database(path.join(dir, "writeme.sqlite"));
    db.exec(`CREATE TABLE notes(id TEXT, title TEXT, content TEXT, filePath TEXT, noteType TEXT, tags TEXT, metadata TEXT, deletedAt TEXT, favorite INTEGER, project TEXT);
CREATE TABLE settings(name TEXT, value TEXT);
CREATE TABLE views(id TEXT, columns TEXT, viewConfig TEXT);
CREATE TABLE tabs(id TEXT, noteId TEXT, project TEXT);
CREATE TABLE noteGroupMembers(id TEXT, noteId TEXT, groupId TEXT);`);
    return { dir, workspace, db };
}
const reader = (dir: string, workspace?: string) =>
    createWorkspaceReader({
        profile: "development",
        dataDir: dir,
        ...(workspace ? { workspace } : {}),
    });
async function hashes(dir: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const name of await readdir(dir)) {
        if (name.startsWith("writeme.sqlite"))
            result[name] = createHash("sha256")
                .update(await readFile(path.join(dir, name)))
                .digest("hex");
    }
    return result;
}
test("WAL snapshot reads committed saved data and changes no database files", async () => {
    const { dir, db } = await fixture();
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;");
    db.query("INSERT INTO notes(id,content,noteType,tags,metadata,favorite) VALUES(?,?,?,?,?,?)").run(
        "saved",
        "committed in WAL",
        "note",
        '["one"]',
        '{"a":1}',
        1,
    );
    const before = await hashes(dir);
    const snapshot = await reader(dir).snapshot();
    expect(snapshot.notes[0]).toMatchObject({
        id: "saved",
        content: "committed in WAL",
        tags: ["one"],
        metadata: { a: 1 },
        favorite: true,
    });
    expect(snapshot.storageMode).toBe("database");
    expect(snapshot.capabilities.projects).toBe(false);
    expect(await hashes(dir)).toEqual(before);
    db.close();
});
test("canonical roots exclude symlink escapes, hidden trash, deleted notes, and foreign notes", async () => {
    const { dir, workspace, db } = await fixture();
    await mkdir(path.join(workspace, ".trash"));
    await mkdir(path.join(workspace, ".templates"));
    await writeFile(path.join(dir, "secret.md"), "SECRET");
    await symlink(path.join(dir, "secret.md"), path.join(workspace, "escape.md"));
    await writeFile(path.join(workspace, ".trash", "trashed.md"), "TRASH");
    await writeFile(path.join(workspace, "new.mdx"), "discovered");
    await writeFile(path.join(workspace, ".templates", "template.md"), "template");
    await writeFile(path.join(workspace, "deleted.md"), "DELETED");
    for (const [id, file, deleted] of [
        ["escaped", path.join(workspace, "escape.md"), null],
        ["deleted", path.join(workspace, "deleted.md"), "date"],
        ["missing", path.join(workspace, "missing.md"), null],
    ])
        db.query("INSERT INTO notes(id,filePath,noteType,deletedAt) VALUES(?,?,?,?)").run(
            id!,
            file!,
            "note",
            deleted ?? null,
        );
    db.close();
    const snapshot = await reader(dir, workspace).snapshot();
    expect(snapshot.notes.map((note) => note.ref).sort()).toEqual([
        "missing",
        "templates:template.md",
        "workspace:new.mdx",
    ]);
    expect(snapshot.notes.find((note) => note.id === "missing")).toMatchObject({
        content: null,
        error: "Backing file is missing, unreadable, or exceeds the 10 MiB read limit.",
    });
    expect(JSON.stringify(snapshot)).not.toContain("SECRET");
    expect(snapshot.complete).toBe(false);
});
test("settings allowlists remove unknown and nested secrets, malformed metadata is incomplete", async () => {
    const { dir, db } = await fixture();
    for (const [name, value] of [
        ["apiKey", '"SECRET"'],
        ["currency", '{"apiKey":"SECRET","preferredAPI":"frankfurter","cacheDuration":{"token":"SECRET"}}'],
        ["meetingTranscription", '{"endpoint":"https://x/?key=SECRET","model":"whisper","apiKey":"SECRET"}'],
        ["theme", '{"token":"SECRET"}'],
    ])
        db.query("INSERT INTO settings VALUES(?,?)").run(name!, value!);
    db.exec(`INSERT INTO notes(id,content,noteType,metadata) VALUES('bad','body','note','bad-json');`);
    db.close();
    const snapshot = await reader(dir).snapshot();
    expect(JSON.stringify(snapshot.settings)).not.toContain("SECRET");
    expect(snapshot.settings.currency).toEqual({ preferredAPI: "frankfurter" });
    expect(snapshot.complete).toBe(false);
});
test("saved directory and custom roots are honored and collections filter note membership", async () => {
    const { dir, workspace, db } = await fixture();
    const custom = path.join(dir, "custom");
    await mkdir(custom);
    await writeFile(path.join(custom, "q.tex"), "equation");
    db.query("INSERT INTO settings VALUES('directory',?)").run(JSON.stringify(workspace));
    db.query("INSERT INTO settings VALUES('quicknotesDirectory',?)").run(JSON.stringify(custom));
    db.exec(
        `INSERT INTO notes(id,content,noteType) VALUES('local','body','note'); INSERT INTO tabs VALUES('ok','local',NULL),('foreign','other','foreign'); INSERT INTO noteGroupMembers VALUES('ok','local','g'),('foreign','other','g'); INSERT INTO views VALUES('v','[]','{}');`,
    );
    db.query("UPDATE notes SET project = ? WHERE id = 'local'").run(workspace);
    db.close();
    const snapshot = await reader(dir).snapshot();
    expect(snapshot.workspace).toBe(await realpath(workspace));
    expect(snapshot.notes.some((note) => note.ref === "quicknotes:q.tex")).toBe(true);
    expect(snapshot.collections.tabs.map((row) => row.id)).toEqual(["ok"]);
    expect(snapshot.collections.noteGroupMembers.map((row) => row.id)).toEqual(["ok"]);
    expect(snapshot.collections.views[0]?.columns).toEqual([]);
});
test("missing database is not created and incompatible schema is actionable", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mcp-reader-missing-"));
    cleanup.push(dir);
    await expect(reader(dir).snapshot()).rejects.toMatchObject({
        code: "DATABASE_NOT_FOUND",
    });
    expect(await readdir(dir)).toEqual([]);
    const db = new Database(path.join(dir, "writeme.sqlite"));
    db.exec("CREATE TABLE notes(id TEXT)");
    db.close();
    await expect(reader(dir).snapshot()).rejects.toMatchObject({
        code: "INCOMPATIBLE_SCHEMA",
    });
});

test("default roots never follow escaping directory symlinks and document bytes remain unchanged", async () => {
    const { dir, workspace, db } = await fixture();
    const outside = path.join(dir, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.md"), "SECRET");
    await symlink(outside, path.join(workspace, ".templates"), "dir");
    await symlink(outside, path.join(workspace, "quicknotes"), "dir");
    const file = path.join(workspace, "note.md");
    await writeFile(file, "saved content");
    db.query("INSERT INTO notes(id,filePath,content,noteType) VALUES(?,?,?,?)").run(
        "note",
        file,
        "stale database content",
        "note",
    );
    db.close();
    const before = await hashes(dir);
    const contentBefore = await readFile(file);
    const snapshot = await reader(dir, workspace).snapshot();
    expect(snapshot.notes).toHaveLength(1);
    expect(snapshot.notes[0]?.content).toBe("saved content");
    expect(snapshot.roots.map((root) => root.kind)).toEqual(["workspace"]);
    expect(await hashes(dir)).toEqual(before);
    expect(await readFile(file)).toEqual(contentBefore);
});

test("filesystem scope filters local-only notes, groups and tabs from other workspaces", async () => {
    const { dir, workspace, db } = await fixture();
    await writeFile(path.join(workspace, "note.md"), "body");
    db.exec(
        "CREATE TABLE noteGroups(id TEXT, title TEXT); INSERT INTO noteGroups VALUES('g','included'),('other','excluded'); INSERT INTO notes(id,content,noteType) VALUES('local-only','local secret','note');",
    );
    db.query("INSERT INTO notes(id,filePath,noteType) VALUES('visible',?,'note')").run(
        path.join(workspace, "note.md"),
    );
    db.query("INSERT INTO tabs VALUES('good','visible',?),('bad','visible','another-workspace')").run(
        workspace,
    );
    db.exec("INSERT INTO noteGroupMembers VALUES('good','visible','g'),('bad','local-only','other')");
    db.close();
    const snapshot = await reader(dir, workspace).snapshot();
    expect(snapshot.notes.map((note) => note.id)).toEqual(["visible"]);
    expect(snapshot.collections.tabs.map((row) => row.id)).toEqual(["good"]);
    expect(snapshot.collections.noteGroups.map((row) => row.id)).toEqual(["g"]);
    expect(snapshot.notes[0]?.source).toBe("filesystem");
});

test("unindexed Markdown exposes frontmatter and prose hashtags without code hashtags", async () => {
    const { dir, workspace, db } = await fixture();
    db.close();
    const content =
        "---\ntitle: Diagram\nexcalidraw-plugin: parsed\ntags: [frontmatter]\n---\n#prose `#inline`\n```js\n#fenced\n```";
    await writeFile(path.join(workspace, "drawing.md"), content);
    const snapshot = await reader(dir, workspace).snapshot();
    expect(snapshot.notes[0]).toMatchObject({
        title: "Diagram",
        noteType: "excalidraw",
        tags: ["frontmatter", "prose"],
        content,
    });
});

test("invalid saved directory fails closed and malformed optional schema disables capability", async () => {
    const { dir, db } = await fixture();
    db.exec("INSERT INTO settings VALUES('directory','bad-json')");
    await expect(reader(dir).snapshot()).rejects.toMatchObject({
        code: "INVALID_SETTINGS",
    });
    db.exec("DELETE FROM settings; DROP TABLE tabs; CREATE TABLE tabs(id TEXT)");
    db.close();
    const snapshot = await reader(dir).snapshot();
    expect(snapshot.capabilities.tabs).toBe(false);
    expect(snapshot.complete).toBe(false);
});

test("oversize discovered files do not hide readable siblings", async () => {
    const { dir, workspace, db } = await fixture();
    db.close();
    await writeFile(path.join(workspace, "a-large.md"), "x".repeat(10 * 1024 * 1024 + 1));
    await writeFile(path.join(workspace, "z-readable.md"), "readable saved content");
    const snapshot = await reader(dir, workspace).snapshot();
    expect(snapshot.notes.some((note) => note.content === "readable saved content")).toBe(true);
    expect(snapshot.complete).toBe(false);
});

test("oversize saved backing files are explicit and never returned", async () => {
    const { dir, workspace, db } = await fixture();
    const file = path.join(workspace, "large.md");
    await writeFile(file, "x".repeat(10 * 1024 * 1024 + 1));
    db.query("INSERT INTO notes(id,filePath,noteType) VALUES('large',?,'note')").run(file);
    db.close();
    const snapshot = await reader(dir, workspace).snapshot();
    expect(snapshot.notes[0]?.content).toBeNull();
    expect(snapshot.notes[0]?.error).toContain("10 MiB");
    expect(snapshot.complete).toBe(false);
});
