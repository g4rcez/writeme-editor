import { expect, goHome, test } from "./fixtures";

const NOTE_TITLE = "E2E test note";
const NOTE_BODY = "Hello from Playwright";

test.describe("Create note flow", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("creates a note from dialog and lands on the editor", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await expect(dialog).toBeVisible();

        const titleInput = dialog.getByTitle("Note title");
        await titleInput.fill(NOTE_TITLE);
        await dialog.getByRole("button", { name: /^Create/ }).click();

        await expect(page).toHaveURL(/\/note\/[^/]+$/);
        await expect(dialog).toBeHidden();
        await expect(page.locator("[data-tab-id]").filter({ hasText: NOTE_TITLE })).toBeVisible();
    });

    test("editor controls and selection toolbar stay within narrow viewports", async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill("Responsive editor");
        await dialog.getByRole("button", { name: /^Create/ }).click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);

        const noteTools = page.getByRole("toolbar", { name: "Note tools" });
        await noteTools.getByRole("button", { name: "Formatted", exact: true }).click();
        const editor = page.locator(".ProseMirror").first();
        await expect(editor).toBeVisible();

        const header = page.locator(".writeme-note-header");
        const narrowHeader = await header.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }));
        expect(narrowHeader.scrollWidth).toBeLessThanOrEqual(narrowHeader.clientWidth);

        await editor.click();
        await page.keyboard.type("Responsive writing remains comfortable.");
        await page.keyboard.press("ControlOrMeta+a");
        const formattingToolbar = page.getByRole("toolbar", { name: "Formatting toolbar" });
        await expect(formattingToolbar).toBeVisible();
        const toolbarBounds = await formattingToolbar.boundingBox();
        if (!toolbarBounds) throw new Error("Formatting toolbar has no visible bounds.");
        expect(toolbarBounds.x).toBeGreaterThanOrEqual(0);
        expect(toolbarBounds.x + toolbarBounds.width).toBeLessThanOrEqual(376);
        expect(toolbarBounds.height).toBeLessThanOrEqual(60);

        const boldBounds = await formattingToolbar.getByRole("button", { name: /Bold/ }).boundingBox();
        if (!boldBounds) throw new Error("Bold control has no visible bounds.");
        expect(boldBounds.width).toBeGreaterThanOrEqual(36);
        expect(boldBounds.height).toBeGreaterThanOrEqual(36);

        await page.keyboard.press("ArrowRight");
        await page.setViewportSize({ width: 812, height: 375 });
        const landscapeHeader = await header.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }));
        expect(landscapeHeader.scrollWidth).toBeLessThanOrEqual(landscapeHeader.clientWidth);
    });

    test("typed content persists across reload", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill(NOTE_TITLE);
        await dialog.getByRole("button", { name: /^Create/ }).click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);

        const editor = page.locator(".ProseMirror").first();
        await editor.click();
        await page.keyboard.type(NOTE_BODY);
        await expect(editor).toContainText(NOTE_BODY);

        const noteUrl = page.url();
        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await expect(saveStatus).toHaveText("Unsaved changes");
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
        await page.reload();
        await expect(page).toHaveURL(noteUrl);
        await expect(page.locator(".ProseMirror").first()).toContainText(NOTE_BODY);
    });

    test("dialog blocks submission when title is empty", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill("");
        await dialog.getByRole("button", { name: /^Create/ }).click();

        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(/\/$/);
    });

    test("Excalidraw creation autocompletes and saves to a workspace folder", async ({ cleanPage: page }) => {
        await page.evaluate(async () => {
            const openRequest = indexedDB.open("writeme");
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                openRequest.onsuccess = () => resolve(openRequest.result);
                openRequest.onerror = () => reject(openRequest.error);
            });
            const transaction = database.transaction("settings", "readwrite");
            const settings = transaction.objectStore("settings");
            const readSettings = settings.getAll();
            await new Promise<void>((resolve, reject) => {
                readSettings.onsuccess = () => {
                    const existing = readSettings.result.find((entry) => entry.name === "directory");
                    settings.put({
                        ...existing,
                        id: existing?.id ?? "e2e-workspace-directory",
                        name: "directory",
                        value: JSON.stringify("/workspace"),
                        type: existing?.type ?? "setting",
                        createdAt: existing?.createdAt ?? new Date(),
                        updatedAt: new Date(),
                    });
                };
                readSettings.onerror = () => reject(readSettings.error);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            });
            database.close();
        });

        await page.reload();
        await goHome(page);
        await page.evaluate(() => {
            Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Electron" });

            let fileSearchListener:
                | ((event: {
                      requestId: string;
                      type: "batch" | "complete";
                      entries?: Array<{ name: string; path: string; relativePath: string; type: "directory" }>;
                      truncated?: boolean;
                  }) => void)
                | null = null;

            Object.defineProperty(window, "electronAPI", {
                configurable: true,
                value: {
                    fs: {
                        onFileSearchEvent: (callback: typeof fileSearchListener) => {
                            fileSearchListener = callback;
                            return () => {
                                fileSearchListener = null;
                            };
                        },
                        startFileSearch: async (_rootPath: string, _query: string, requestId: string) => {
                            window.setTimeout(() => {
                                fileSearchListener?.({
                                    requestId,
                                    type: "batch",
                                    entries: [
                                        {
                                            name: "Frontend tools",
                                            path: "/workspace/Frontend tools",
                                            relativePath: "Frontend tools",
                                            type: "directory",
                                        },
                                    ],
                                });
                                fileSearchListener?.({ requestId, type: "complete", truncated: false });
                            }, 10);
                            return { success: true };
                        },
                        cancelFileSearch: async () => ({ success: true }),
                        readDir: async () => ({ entries: [] }),
                        statFile: async () => ({ success: true, exists: false }),
                    },
                },
            });
        });

        await page.keyboard.press("ControlOrMeta+Shift+P");
        const commandPalette = page.getByRole("dialog", { name: "Command palette" });
        await commandPalette.getByPlaceholder("Search for...").fill("New excalidraw");
        await commandPalette.getByText("New excalidraw", { exact: true }).click();

        const dialog = page.getByRole("dialog", { name: "Create Excalidraw note" });
        await dialog.getByTitle("Note title").fill("Folder autocomplete drawing");
        await dialog.getByTitle("Folder (optional)").fill("frontend");
        await dialog.getByRole("option", { name: "./Frontend tools" }).click();
        await expect(dialog.getByRole("button", { name: /^Create/ })).toBeEnabled();
        await dialog.getByRole("button", { name: /^Create/ }).click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);

        const note = await page.evaluate(async () => {
            const openRequest = indexedDB.open("writeme");
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                openRequest.onsuccess = () => resolve(openRequest.result);
                openRequest.onerror = () => reject(openRequest.error);
            });
            const transaction = database.transaction("notes", "readonly");
            const records = await new Promise<Array<{ title: string; noteType: string; filePath: string | null }>>(
                (resolve, reject) => {
                    const request = transaction.objectStore("notes").getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                },
            );
            database.close();
            return records.find((record) => record.title === "Folder autocomplete drawing");
        });

        expect(note).toMatchObject({
            title: "Folder autocomplete drawing",
            noteType: "excalidraw",
            filePath: "/workspace/Frontend tools/folder-autocomplete-drawing.md",
        });
    });

    test("renames the current note from the command palette", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const createDialog = page.getByRole("dialog", { name: /Create new note/i });
        await createDialog.getByTitle("Note title").fill("Current note title");
        await createDialog.getByRole("button", { name: /^Create/ }).click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);

        const editor = page.locator(".ProseMirror").first();
        await editor.click();
        await page.keyboard.press("ControlOrMeta+Alt+1");
        await page.keyboard.type("Current note title");
        await page.keyboard.press("Enter");
        await page.keyboard.type("Body");
        await expect(editor.locator("h1")).toHaveText("Current note title");
        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await expect(saveStatus).toHaveText("Unsaved changes");
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });

        await page.keyboard.press("ControlOrMeta+Shift+P");
        const commandPalette = page.getByRole("dialog", { name: "Command palette" });
        await commandPalette.getByPlaceholder("Search for...").fill("Rename current note");
        await commandPalette.getByText("Rename current note", { exact: true }).click();

        const renameDialog = page.getByRole("dialog", { name: "Rename note" });
        const titleInput = renameDialog.getByPlaceholder("Note title");
        await expect(titleInput).toHaveValue("Current note title");
        await titleInput.fill("Renamed note");
        await renameDialog.getByRole("button", { name: "OK" }).click();

        await expect(page.getByRole("button", { name: "Close Renamed note" })).toBeVisible();
        await expect(editor.locator("h1")).toHaveText("Renamed note");
        await page.getByRole("button", { name: "Close Renamed note" }).click();
        await expect(page).toHaveURL(/\/$/);

        const savedNote = page.getByRole("link", { name: /Renamed note/ });
        await expect(savedNote).toBeVisible();
        await savedNote.click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);
        await expect(page.locator(".ProseMirror h1")).toHaveText("Renamed note");
    });

    test("created note appears with a preview in the dashboard recent list", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill(NOTE_TITLE);
        await dialog.getByRole("button", { name: /^Create/ }).click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);

        const editor = page.locator(".ProseMirror").first();
        await editor.click();
        await page.keyboard.type(NOTE_BODY);
        await expect(page.locator(".writeme-editor-status-bar output")).toHaveText("Saved", { timeout: 10_000 });

        await page.getByRole("button", { name: `Close ${NOTE_TITLE}` }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();

        const recentNote = page.getByRole("link", { name: new RegExp(NOTE_TITLE) });
        await expect(recentNote).toBeVisible();
        await expect(recentNote).toContainText(NOTE_BODY);
    });
});
