import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Note, NoteType } from "../../packages/editor/src/store/note";

async function launchAgendaApp(): Promise<{ application: ElectronApplication; directory: string; page: Page }> {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-agenda-native-"));
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const buildRoot = path.resolve(process.env.AGENDA_ELECTRON_BUILD_ROOT ?? ".vite");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(path.join(buildRoot, "build/main.js"))});\n`,
    );
    try {
        const application = await electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production" },
        });
        const page = await application.firstWindow();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        expect(
            (await application.evaluate(({ app }) => app.getPath("userData"))).startsWith(directory + path.sep),
        ).toBe(true);
        return { application, directory, page };
    } catch (error) {
        await rm(directory, { recursive: true, force: true });
        throw error;
    }
}

async function selectWorkspace(application: ElectronApplication, page: Page, workspace: string): Promise<void> {
    await mkdir(workspace, { recursive: true });
    await application.evaluate(({ dialog }, selected) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
    }, workspace);
    await page.evaluate(async () => {
        const selected = await window.electronAPI.fs.chooseDirectory();
        await window.electronAPI.db.save("settings", {
            id: "directory",
            name: "directory",
            value: JSON.stringify(selected),
            type: "setting",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
}

async function openCalendarSlot(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.location.hash = "/calendar?date=2025-12-31";
    });
    await page
        .getByRole("grid")
        .getByRole("button", { name: /Wednesday, Dec 31, 2025/ })
        .click();
    await page.getByRole("button", { name: "12:00", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "New note", exact: true })).toBeVisible();
}

test("preserves a title-only legacy day in SQLite and reuses a renamed filesystem daily note from Today and calendar", async () => {
    const { application, directory, page } = await launchAgendaApp();
    try {
        const content = "# Retrospective\n\nPreserved native journal content\n";
        const legacy = Note.parse({
            ...Note.new("2025-12-31-quicknote.md", content, NoteType.quick),
            createdAt: new Date(2026, 0, 7),
        });
        await page.evaluate(async (note) => {
            await window.electronAPI.db.save("notes", note);
        }, legacy);
        await page.evaluate((id) => {
            window.location.hash = `/note/${id}`;
        }, legacy.id);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText(
            "Preserved native journal content",
        );
        await expect
            .poll(() =>
                page.evaluate(async (id) => {
                    const note = await window.electronAPI.db.get<Note>("notes", id);
                    return {
                        title: note?.title,
                        journalDate: note?.metadata.journalDate,
                        content: note?.content,
                        createdAt: note?.createdAt,
                    };
                }, legacy.id),
            )
            .toEqual({
                title: "Retrospective",
                journalDate: "2025-12-31",
                content,
                createdAt: legacy.createdAt.toISOString(),
            });
        await page.reload();
        await page.evaluate(() => {
            window.location.hash = "/today?date=2025-12-31";
        });
        await page.getByRole("button", { name: "Open daily note", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/note/${legacy.id}$`));
        // Move the same metadata identity to a supported non-canonical workspace path.
        const workspace = path.join(directory, "workspace");
        const filePath = path.join(workspace, "archive", "retrospective.md");
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, content);
        await page.evaluate(() => {
            window.location.hash = "/";
        });
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page.evaluate(
            async ({ id, filePath }) => {
                const note = await window.electronAPI.db.get<Note>("notes", id);
                if (!note) throw new Error("Legacy note disappeared");
                await window.electronAPI.db.save("notes", {
                    ...note,
                    filePath,
                    content: "",
                    lastSynced: new Date().toISOString(),
                });
            },
            { id: legacy.id, filePath },
        );
        await selectWorkspace(application, page, workspace);
        await page.evaluate(() => {
            window.location.hash = "/today?date=2025-12-31";
        });
        await expect(page.getByRole("region", { name: "Daily note", exact: true })).toContainText("Retrospective");
        await page.getByRole("button", { name: "Open daily note", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/note/${legacy.id}$`));
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText(
            "Preserved native journal content",
        );
        await page.reload();
        await openCalendarSlot(page);
        await page
            .getByRole("dialog", { name: "New note", exact: true })
            .getByRole("button", { name: "Open daily note", exact: true })
            .click();
        await expect(page).toHaveURL(new RegExp(`/note/${legacy.id}$`));
        expect(await readFile(filePath, "utf8")).toBe(content);
        expect(await readdir(workspace, { recursive: true })).not.toContain(
            path.join("quicknotes", "2025-12-31-quicknote.md"),
        );
        const daily = await page.evaluate(async () =>
            (await window.electronAPI.db.getAll<Note>("notes")).filter((note) => note.noteType === "quick"),
        );
        expect(daily).toHaveLength(1);
        expect(daily[0]?.metadata.journalDate).toBe("2025-12-31");
        expect(daily[0]?.createdAt).toBe(legacy.createdAt.toISOString());
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});

test("does not redirect obsolete native daily I/O after date, route or calendar-modal changes", async () => {
    const { application, directory, page } = await launchAgendaApp();
    try {
        const workspace = path.join(directory, "workspace");
        await selectWorkspace(application, page, workspace);
        for (const intent of ["date", "route", "cancel", "calendar route"] as const) {
            const calendar = intent === "cancel" || intent === "calendar route";
            // Remove each prior completed note so every request crosses the canonical-file I/O boundary.
            await page.evaluate(async () => {
                for (const note of await window.electronAPI.db.getAll<Note>("notes"))
                    await window.electronAPI.db.notes.hardDelete(note.id);
            });
            await rm(path.join(workspace, "quicknotes"), { recursive: true, force: true });
            if (calendar) await openCalendarSlot(page);
            else {
                await page.evaluate(() => {
                    window.location.hash = "/today?date=2025-12-31";
                });
                await expect(page.getByRole("button", { name: "Create daily note", exact: true })).toBeVisible();
            }
            // Fault-inject latency at IPC while retaining the real filesystem handler and its access checks.
            await application.evaluate(({ ipcMain }) => {
                const handlers = Reflect.get(ipcMain, "_invokeHandlers");
                const original = handlers.get("fs:statFile");
                if (typeof original !== "function") throw new Error("Filesystem stat handler unavailable");
                const gate = Promise.withResolvers<void>();
                Reflect.set(globalThis, "releaseAgendaDaily", gate.resolve);
                Reflect.set(globalThis, "agendaDailyStarted", false);
                ipcMain.removeHandler("fs:statFile");
                ipcMain.handle("fs:statFile", async (...args: unknown[]) => {
                    if (typeof args[1] === "string" && args[1].endsWith("2025-12-31-quicknote.md")) {
                        Reflect.set(globalThis, "agendaDailyStarted", true);
                        await gate.promise;
                    }
                    return original(...args);
                });
                Reflect.set(globalThis, "restoreAgendaStat", () => {
                    ipcMain.removeHandler("fs:statFile");
                    ipcMain.handle("fs:statFile", original);
                });
            });
            await page
                .getByRole("button", { name: calendar ? "Open daily note" : "Create daily note", exact: true })
                .click();
            await expect
                .poll(() => application.evaluate(() => Reflect.get(globalThis, "agendaDailyStarted")))
                .toBe(true);
            if (intent === "date") await page.getByRole("button", { name: "Next day", exact: true }).click();
            else if (intent === "cancel") await page.getByRole("button", { name: "Cancel", exact: true }).click();
            else if (intent === "calendar route") await page.evaluate(() => { window.location.hash = "/tasks"; });
            else await page.getByRole("button", { name: "Open tasks", exact: true }).first().click();
            const destination = page.url();
            await application.evaluate(() => Reflect.get(globalThis, "releaseAgendaDaily")());
            await expect
                .poll(() =>
                    page.evaluate(
                        async () =>
                            (await window.electronAPI.db.getAll<Note>("notes")).filter(
                                (note) => note.noteType === "quick",
                            ).length,
                    ),
                )
                .toBe(1);
            await page.waitForTimeout(200);
            await expect(page).toHaveURL(destination);
            await expect(page.getByRole("dialog", { name: "New note", exact: true })).toBeHidden();
            expect(await readFile(path.join(workspace, "quicknotes", "2025-12-31-quicknote.md"), "utf8")).toBe("");
            await application.evaluate(() => Reflect.get(globalThis, "restoreAgendaStat")());
            await page.evaluate(() => {
                window.location.hash = "/";
            });
            await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        }
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
