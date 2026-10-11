import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const mainContent =
    "# Contract\n\nSaved canonical body #contract\n\n[Target](./target.md)\n\n## Detail\nSection body\n\n![asset](data:image/png;base64,PRIVATE_ASSET)\n";
export const drawingContent =
    '---\nexcalidraw-plugin: parsed\n---\n\n# Drawing\n\n```json\n{"type":"excalidraw","version":2,"elements":[{"id":"shape-one","type":"rectangle"}],"files":{"image":{"dataURL":"data:image/png;base64,PRIVATE_DRAWING"}}}\n```\n';
export const latexContent =
    "\\documentclass{article}\n\\begin{document}\nContract equation $E=mc^2$.\n\\end{document}\n";

export type ContractFixture = {
    directory: string;
    workspace: string;
    filesystem: boolean;
    hashes: () => Promise<Record<string, string>>;
    mutate: () => Promise<void>;
    removeViews: () => void;
    close: () => Promise<void>;
};

export async function contractWorkspace(filesystem: boolean): Promise<ContractFixture> {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-contract-"));
    const workspace = path.join(directory, "workspace");
    const templates = path.join(workspace, ".templates");
    const quicknotes = path.join(workspace, "quicknotes");
    await mkdir(templates, { recursive: true });
    await mkdir(quicknotes);
    const databasePath = path.join(directory, "writeme.sqlite");
    const db = new Database(databasePath);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;");
    db.exec(`CREATE TABLE notes(id TEXT, title TEXT, content TEXT, filePath TEXT, noteType TEXT, tags TEXT, metadata TEXT, deletedAt TEXT, favorite INTEGER, project TEXT, createdAt TEXT, updatedAt TEXT);
        CREATE TABLE settings(name TEXT, value TEXT);
        CREATE TABLE projects(id TEXT, folderPath TEXT, name TEXT);
        CREATE TABLE noteGroups(id TEXT, name TEXT);
        CREATE TABLE noteGroupMembers(id TEXT, noteId TEXT, groupId TEXT);
        CREATE TABLE views(id TEXT, columns TEXT, viewConfig TEXT);
        CREATE TABLE tabs(id TEXT, noteId TEXT, project TEXT, "order" INTEGER);`);
    const settings: [string, unknown][] = [
        ["directory", filesystem ? workspace : null],
        ["templatesDirectory", templates],
        ["quicknotesDirectory", quicknotes],
        ["theme", "dark"],
        ["autosave", false],
        ["autosaveDelay", 5000],
        ["apiKey", "PRIVATE_API_KEY"],
        [
            "currency",
            {
                preferredAPI: "frankfurter",
                cacheDuration: 3600,
                apiKey: "PRIVATE_CURRENCY_KEY",
            },
        ],
        [
            "meetingTranscription",
            {
                model: "whisper",
                localSpeaker: "Me",
                endpoint: "https://private.invalid/?key=PRIVATE_ENDPOINT",
                apiKey: "PRIVATE_MEETING_KEY",
            },
        ],
    ];
    for (const [name, value] of settings)
        db.query("INSERT INTO settings VALUES(?,?)").run(name, JSON.stringify(value));
    const entries = [
        {
            id: "target",
            title: "target",
            file: "target.md",
            content: "# Target\nBacklink destination.",
            type: "note",
            metadata: {},
        },
        {
            id: "main",
            title: "Contract",
            file: "main.md",
            content: mainContent,
            type: "note",
            metadata: { author: "Contract author" },
        },
        {
            id: "meeting",
            title: "Meeting",
            file: "meeting.md",
            content: "# Meeting\nSaved summary.",
            type: "meeting-note",
            metadata: {
                meetingTranscript: [
                    {
                        speaker: "Speaker 1",
                        text: "Saved transcript",
                        start: 0,
                        end: 1,
                    },
                ],
            },
        },
        {
            id: "drawing",
            title: "Drawing",
            file: "drawing.md",
            content: drawingContent,
            type: "excalidraw",
            metadata: {},
        },
        {
            id: "comments",
            title: "comments_main",
            file: "comments_main.md",
            content: "## detail-thread\n\n> Section body\n\n- First saved comment\n- Second saved comment\n",
            type: "note",
            metadata: { commentSourceId: "main" },
        },
        {
            id: "latex",
            title: "Equation",
            file: "equation.tex",
            content: latexContent,
            type: "latex",
            metadata: {},
        },
        {
            id: "template",
            title: "Review template",
            file: ".templates/review.md",
            content: "# Review template\nTemplate content.",
            type: "template",
            metadata: {},
        },
    ];
    for (const entry of entries) {
        const file = path.join(workspace, entry.file);
        if (filesystem) await writeFile(file, entry.content);
        db.query("INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
            entry.id,
            entry.title,
            filesystem ? "STALE_DATABASE_COPY" : entry.content,
            filesystem ? file : null,
            entry.type,
            JSON.stringify(entry.id === "main" ? ["saved-tag"] : []),
            JSON.stringify(entry.metadata),
            null,
            entry.id === "main" ? 1 : 0,
            "project-one",
            "2026-01-01T00:00:00.000Z",
            "2026-01-01T00:00:00.000Z",
        );
    }
    if (filesystem)
        await writeFile(path.join(workspace, "space # ü.md"), "# Encoded reference\nDiscovered file.");
    db.query("INSERT INTO projects VALUES(?,?,?)").run("project-one", workspace, "Contract project");
    db.exec(`INSERT INTO noteGroups VALUES('group-one','Contract group');
        INSERT INTO noteGroupMembers VALUES('member-one','main','group-one');
        INSERT INTO views VALUES('view-one','["title","tags"]','{"filter":{"favorite":true}}');`);
    db.query("INSERT INTO tabs VALUES(?,?,?,?)").run(
        "tab-target",
        "target",
        filesystem ? workspace : "__local__",
        2,
    );
    db.query("INSERT INTO tabs VALUES(?,?,?,?)").run(
        "tab-main",
        "main",
        filesystem ? workspace : "__local__",
        1,
    );
    const hashes = async (): Promise<Record<string, string>> => {
        const result: Record<string, string> = {};
        const walk = async (folder: string): Promise<void> => {
            for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) =>
                a.name.localeCompare(b.name),
            )) {
                const file = path.join(folder, entry.name);
                if (entry.isDirectory()) await walk(file);
                else
                    result[path.relative(directory, file)] = createHash("sha256")
                        .update(await readFile(file))
                        .digest("hex");
            }
        };
        await walk(directory);
        return result;
    };
    return {
        directory,
        workspace,
        filesystem,
        hashes,
        mutate: async (): Promise<void> => {
            if (filesystem)
                await writeFile(path.join(workspace, "main.md"), mainContent + "\nChanged snapshot.\n");
            else {
                const writer = new Database(databasePath);
                writer
                    .query("UPDATE notes SET content = ? WHERE id = 'main'")
                    .run(mainContent + "\nChanged snapshot.\n");
                writer.close();
            }
        },
        removeViews: (): void => {
            const writer = new Database(databasePath);
            writer.exec("DROP TABLE views");
            writer.close();
        },
        close: async (): Promise<void> => {
            db.close();
            await rm(directory, { recursive: true, force: true });
        },
    };
}
