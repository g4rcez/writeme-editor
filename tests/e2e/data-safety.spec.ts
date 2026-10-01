import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

const seedDatabase = async (
    page: Page,
    version: number,
    options: { includeTemplate?: boolean; includeBase?: boolean; conflictingTemplate?: boolean; includeLegacyProject?: boolean } = {},
) => {
    await page.goto("/favicon.ico");
    await page.evaluate(({ version, options }) => {
        const { promise, resolve, reject } = Promise.withResolvers<void>();
        const request = indexedDB.open("writeme", version * 10);
        request.onupgradeneeded = () => {
            const database = request.result;
            const notes = database.createObjectStore("notes", { keyPath: "id" });
            const noteId = options.conflictingTemplate ? "legacy-template" : "legacy-note";
            notes.put({
                id: noteId,
                type: "__writeme_note",
                title: "Legacy note",
                content: "# Preserved note",
                project: "legacy-project",
                createdAt: new Date("2025-01-01T00:00:00.000Z"),
                updatedAt: new Date("2025-01-02T00:00:00.000Z"),
                filePath: null,
                fileSize: 16,
                lastSynced: null,
                tags: [],
                createdBy: "user",
                updatedBy: "user",
                noteType: "note",
                favorite: false,
            });
            if (version === 1) {
                if (options.includeLegacyProject) {
                    database.createObjectStore("project", { keyPath: "id" }).put({
                        id: "legacy-project",
                        title: "Legacy project",
                        description: "Legacy description",
                        notes: ["legacy-note"],
                        createdAt: new Date("2025-01-01T00:00:00.000Z"),
                        updatedAt: new Date("2025-01-02T00:00:00.000Z"),
                    });
                }
            } else {
                const tabs = database.createObjectStore("tabs", { keyPath: "id" });
                tabs.put({ id: "legacy-tab", noteId, order: 0, project: "legacy-project", createdAt: new Date() });
                database.createObjectStore("projects", { keyPath: "id" });
            }
            if (version >= 18) {
                const stores: [string, string][] = [
                    ["hashtags", "id"],
                    ["settings", "id"],
                    ["scripts", "id"],
                    ["noteGroups", "id"],
                    ["noteGroupMembers", "id"],
                    ["aiConfigs", "id"],
                    ["aiChats", "id"],
                    ["aiMessages", "id"],
                    ["aiCredentials", "adapterId"],
                ];
                for (const [name, keyPath] of stores) {
                    database.createObjectStore(name, { keyPath });
                }
            }

            if (options.includeTemplate) {
                database.createObjectStore("templates", { keyPath: "id" }).put({
                    id: "legacy-template",
                    name: "Legacy template",
                    content: "# Template body",
                    createdAt: new Date("2025-01-03T00:00:00.000Z"),
                    updatedAt: new Date("2025-01-04T00:00:00.000Z"),
                });
            }
            if (version >= 18 || options.includeBase) {
                const bases = database.createObjectStore("bases", { keyPath: "id" });
                if (options.includeBase) {
                    bases.put({
                        id: "legacy-base",
                        title: "Legacy base",
                        viewType: "table",
                        createdAt: new Date("2025-01-03T00:00:00.000Z"),
                        updatedAt: new Date("2025-01-04T00:00:00.000Z"),
                    });
                }
            }
            if (version >= 24) {
                database.createObjectStore("views", { keyPath: "id" });
                database.createObjectStore("cursorPositions", { keyPath: "noteId" });
                database.createObjectStore("terminalSessions", { keyPath: "id" });
                database.createObjectStore("noteHistory", { keyPath: "id" });
            }

        };
        request.onsuccess = () => {
            request.result.close();
            resolve();
        };
        request.onerror = () => reject(request.error ?? new Error("Could not seed the legacy database."));
        return promise;
    }, { version, options });
};

test.describe("browser data safety", () => {
    test("copies and retains version-one project records during upgrades", async ({ page }) => {
        await seedDatabase(page, 1, { includeLegacyProject: true });
        await goHome(page);

        const records = await page.evaluate(() => {
            const { promise, resolve, reject } = Promise.withResolvers<{
                source: { id: string; title: string; notes: string[] } | undefined;
                migrated: { id: string; title: string; notes: string[]; folderPath: string } | undefined;
            }>();
            const request = indexedDB.open("writeme");
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(["project", "projects"], "readonly");
                const sourceRequest = transaction.objectStore("project").get("legacy-project");
                const migratedRequest = transaction.objectStore("projects").get("legacy-project");
                let remaining = 2;
                const finish = () => {
                    remaining -= 1;
                    if (remaining !== 0) return;
                    resolve({ source: sourceRequest.result, migrated: migratedRequest.result });
                    database.close();
                };
                sourceRequest.onsuccess = finish;
                migratedRequest.onsuccess = finish;
                transaction.onerror = () => reject(transaction.error ?? new Error("Could not read migrated projects."));
            };
            request.onerror = () => reject(request.error ?? new Error("Could not open the upgraded database."));
            return promise;
        });

        expect(records.source).toMatchObject({ id: "legacy-project", title: "Legacy project", notes: ["legacy-note"] });
        expect(records.migrated).toMatchObject({
            id: "legacy-project",
            title: "Legacy project",
            notes: ["legacy-note"],
            folderPath: "",
        });
    });

    test("preserves legacy templates when upgrading an existing v24 database", async ({ page }) => {
        await seedDatabase(page, 24, { includeTemplate: true });
        await goHome(page);

        const result = await page.evaluate(() => {
            const { promise, resolve, reject } = Promise.withResolvers<{
                source: { content: string } | undefined;
                migrated: { noteType: string; content: string } | undefined;
            }>();
            const request = indexedDB.open("writeme");
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(["templates", "notes"], "readonly");
                const sourceRequest = transaction.objectStore("templates").get("legacy-template");
                const migratedRequest = transaction.objectStore("notes").get("legacy-template");
                let remaining = 2;
                const finish = () => {
                    remaining -= 1;
                    if (remaining !== 0) return;
                    resolve({ source: sourceRequest.result, migrated: migratedRequest.result });
                    database.close();
                };
                sourceRequest.onsuccess = finish;
                migratedRequest.onsuccess = finish;
                transaction.onerror = () => reject(transaction.error ?? new Error("Could not read preserved templates."));
            };
            request.onerror = () => reject(request.error ?? new Error("Could not open the upgraded database."));
            return promise;
        });

        expect(result.source?.content).toBe("# Template body");
        expect(result.migrated).toMatchObject({ noteType: "template", content: "# Template body" });
    });

    test("preserves project assignments and legacy templates through IndexedDB upgrades", async ({ page }) => {
        await seedDatabase(page, 5, { includeTemplate: true });
        await goHome(page);

        const result = await page.evaluate(async () => {
            const loadModule = (path: string) => import(new URL(path, window.location.origin).href);
            const { NotesRepository } = await loadModule("/src/store/repositories/browser/notes.repository.ts");
            const repository = new NotesRepository({} as never);
            const note = await repository.getOne("legacy-note");
            const { promise, resolve, reject } = Promise.withResolvers<{
                template: { id: string; content: string } | undefined;
                migratedTemplate: { noteType: string; content: string } | undefined;
                tab: { project: string } | undefined;
            }>();
            const request = indexedDB.open("writeme");
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(["templates", "notes", "tabs"], "readonly");
                const templatesRequest = transaction.objectStore("templates").get("legacy-template");
                const migratedNoteRequest = transaction.objectStore("notes").get("legacy-template");
                const tabRequest = transaction.objectStore("tabs").get("legacy-tab");
                let remaining = 3;
                const finish = () => {
                    remaining -= 1;
                    if (remaining !== 0) return;
                    resolve({
                        template: templatesRequest.result,
                        migratedTemplate: migratedNoteRequest.result,
                        tab: tabRequest.result,
                    });
                    database.close();
                };
                templatesRequest.onsuccess = finish;
                migratedNoteRequest.onsuccess = finish;
                tabRequest.onsuccess = finish;
                transaction.onerror = () => reject(transaction.error ?? new Error("Could not read upgraded records."));
            };
            request.onerror = () => reject(request.error ?? new Error("Could not open the upgraded database."));
            const records = await promise;
            return { noteProject: note?.project, ...records };
        });

        expect(result.noteProject).toBe("legacy-project");
        expect(result.tab).toMatchObject({ id: "legacy-tab", project: "legacy-project" });
        expect(result.template?.content).toBe("# Template body");
        expect(result.migratedTemplate).toMatchObject({ noteType: "template", content: "# Template body" });
    });

    test("keeps source records and blocks workspace loading when a legacy migration conflicts", async ({ page }) => {
        await seedDatabase(page, 5, { includeTemplate: true, conflictingTemplate: true });
        await page.goto("/");

        await expect(page.getByRole("heading", { name: "Writeme stopped before loading this workspace" })).toBeVisible();
        const records = await page.evaluate(() => {
            const { promise, resolve, reject } = Promise.withResolvers<{
                version: number;
                note: { content: string } | undefined;
                template: { content: string } | undefined;
            }>();
            const request = indexedDB.open("writeme");
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(["notes", "templates"], "readonly");
                const noteRequest = transaction.objectStore("notes").get("legacy-template");
                const templateRequest = transaction.objectStore("templates").get("legacy-template");
                let remaining = 2;
                const finish = () => {
                    remaining -= 1;
                    if (remaining !== 0) return;
                    resolve({ version: database.version, note: noteRequest.result, template: templateRequest.result });
                    database.close();
                };
                noteRequest.onsuccess = finish;
                templateRequest.onsuccess = finish;
                transaction.onerror = () => reject(transaction.error ?? new Error("Could not read retained records."));
            };
            request.onerror = () => reject(request.error ?? new Error("Could not open the retained database."));
            return promise;
        });

        expect(records.version).toBe(50);
        expect(records.note?.content).toBe("# Preserved note");
        expect(records.template?.content).toBe("# Template body");
    });

    test("preserves bases when copying them to views", async ({ page }) => {
        await seedDatabase(page, 18, { includeBase: true });
        await goHome(page);

        const records = await page.evaluate(() => {
            const { promise, resolve, reject } = Promise.withResolvers<{
                base: { title: string } | undefined;
                view: { title: string } | undefined;
            }>();
            const request = indexedDB.open("writeme");
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(["bases", "views"], "readonly");
                const baseRequest = transaction.objectStore("bases").get("legacy-base");
                const viewRequest = transaction.objectStore("views").get("legacy-base");
                let remaining = 2;
                const finish = () => {
                    remaining -= 1;
                    if (remaining !== 0) return;
                    resolve({ base: baseRequest.result, view: viewRequest.result });
                    database.close();
                };
                baseRequest.onsuccess = finish;
                viewRequest.onsuccess = finish;
                transaction.onerror = () => reject(transaction.error ?? new Error("Could not read migrated bases."));
            };
            request.onerror = () => reject(request.error ?? new Error("Could not open the upgraded database."));
            return promise;
        });

        expect(records).toMatchObject({
            base: { id: "legacy-base", title: "Legacy base" },
            view: { id: "legacy-base", title: "Legacy base" },
        });
    });

    test("keeps more than 50 history snapshots after a content update", async ({ page }) => {
        await goHome(page);
        const count = await page.evaluate(async () => {
            const loadModule = (path: string) => import(new URL(path, window.location.origin).href);
            const { db } = await loadModule("/src/store/repositories/browser/dexie-db.ts");
            const { NotesRepository } = await loadModule("/src/store/repositories/browser/notes.repository.ts");
            const { Note } = await loadModule("/src/store/note.ts");
            const note = Note.new("History test", "# Original");
            await db.notes.put(note);
            await db.noteHistory.bulkAdd(
                Array.from({ length: 60 }, (_, index) => ({
                    id: `history-${index}`,
                    noteId: note.id,
                    content: `# Previous ${index}`,
                    createdAt: new Date(Date.UTC(2024, 0, index + 1)),
                })),
            );
            const repository = new NotesRepository({} as never);
            await repository.update(note.id, Note.parse({ ...note, content: "# Updated" }));
            return db.noteHistory.where("noteId").equals(note.id).count();
        });

        expect(count).toBe(61);
    });

    test("rolls back a cross-collection import when a unique index conflicts", async ({ page }) => {
        await goHome(page);
        const result = await page.evaluate(async () => {
            const loadModule = (path: string) => import(new URL(path, window.location.origin).href);
            const { db } = await loadModule("/src/store/repositories/browser/dexie-db.ts");
            const { importFromFile } = await loadModule("/src/lib/data-migration.ts");
            const { Note } = await loadModule("/src/store/note.ts");
            const now = new Date();
            const note = Note.new("Should roll back", "# Content");
            await db.settings.put({
                id: "existing-setting",
                name: "migration-collision",
                value: "old",
                type: "setting",
                createdAt: now,
                updatedAt: now,
            });
            const file = new File(
                [
                    JSON.stringify({
                        type: "writeme-migration",
                        version: 2,
                        notes: [note],
                        tabs: [],
                        hashtags: [],
                        settings: [
                            {
                                id: "incoming-setting",
                                name: "migration-collision",
                                value: "new",
                                type: "setting",
                                createdAt: now,
                                updatedAt: now,
                            },
                        ],
                        scripts: [],
                        noteHistory: [],
                    }),
                ],
                "backup.json",
                { type: "application/json" },
            );
            let rejected = false;
            try {
                await importFromFile(file);
            } catch {
                rejected = true;
            }
            return {
                rejected,
                importedNote: await db.notes.get(note.id),
                settingCount: await db.settings.where("name").equals("migration-collision").count(),
            };
        });

        expect(result.rejected).toBe(true);
        expect(result.importedNote).toBeUndefined();
        expect(result.settingCount).toBe(1);
    });

    test("does not auto-purge web notes or expose retention settings", async ({ page }) => {
        await goHome(page);
        const id = await page.evaluate(async () => {
            const loadModule = (path: string) => import(new URL(path, window.location.origin).href);
            const { db } = await loadModule("/src/store/repositories/browser/dexie-db.ts");
            const { Note } = await loadModule("/src/store/note.ts");
            const note = Note.parse({
                title: "Expired trash note",
                content: "# Still recoverable",
                deletedAt: new Date("2000-01-01T00:00:00.000Z"),
            });
            await db.notes.put(note);
            return note.id;
        });
        await page.reload();
        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();

        const retained = await page.evaluate(async (noteId) => {
            const loadModule = (path: string) => import(new URL(path, window.location.origin).href);
            const { db } = await loadModule("/src/store/repositories/browser/dexie-db.ts");
            return db.notes.get(noteId);
        }, id);
        expect(retained?.deletedAt).toBeTruthy();

        await page.goto("/settings/trash");
        await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
        await expect(page.getByText("Auto-purge after")).toHaveCount(0);
    });
});
