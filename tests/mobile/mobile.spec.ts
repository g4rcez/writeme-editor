import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function importMarkdown(page: Page, title: string, content: string): Promise<void> {
    await page.getByLabel("Import Markdown file", { exact: true }).setInputFiles({
        name: `${title}.md`,
        mimeType: "text/markdown",
        buffer: Buffer.from(content),
    });
    await expect(page).toHaveURL(/#\/note\//);
    await expect(page.locator(".ProseMirror").first()).toContainText(content);
}

test("mobile shell has accessible touch controls and omits AI", async ({ page }) => {
    const errors: string[] = [];
    const aiRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
        if (/localhost:4079|api\.openai\.com|api\.anthropic\.com/.test(request.url())) aiRequests.push(request.url());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/platform-mobile/);
    await expect(page.getByRole("button", { name: "Ask AI", exact: true })).toHaveCount(0);
    const menu = page.getByRole("button", { name: "Open workspace menu", exact: true });
    const bounds = await menu.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    await menu.click();
    await expect(page.getByRole("button", { name: "Workspace AI", exact: true })).toHaveCount(0);
    await page.goto("/#/settings/ai");
    await expect(page.getByRole("heading", { name: "Not found", exact: true })).toBeVisible();
    for (const route of ["chat", "oauth/callback", "terminal/example", "folder"]) {
        await page.goto(`/#/${route}`);
        await expect(page).toHaveURL(/#\/$/);
    }
    expect(errors).toEqual([]);
    expect(aiRequests).toEqual([]);
});

test("imports, edits, saves on backgrounding and exports a note offline", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "Mobile note", "Original text");
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await editor.press("End");
    await editor.pressSequentially(" saved on pause");
    await page.evaluate(() => window.dispatchEvent(new Event("writeme:mobile-pause")));
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved");
    const noteUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(noteUrl);
    await expect(editor).toContainText("saved on pause");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export note", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("Mobile note.md");
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create new note" });
    await dialog.getByTitle("Note title").fill("Offline note");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(noteUrl);
    await expect(editor).toBeVisible();
    await expect(editor).not.toContainText("Original text");
    await editor.fill("Written offline");
    await page.evaluate(() => window.dispatchEvent(new Event("writeme:mobile-pause")));
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved");
    const header = page.locator(".writeme-app-header");
    expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/playwright/mobile/${test.info().project.name}-editor.png` });
});

test("backup round trip preserves notes and PDF bytes and excludes AI", async ({ page, browser }) => {
    await page.goto("/");
    await importMarkdown(page, "Backed up note", "Keep this content");
    await page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("writeme");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        await new Promise<void>((resolve, reject) => {
            const tx = database.transaction(["pdfAssets", "aiCredentials"], "readwrite");
            tx.objectStore("pdfAssets").put({ id: "mobile-pdf", data: new TextEncoder().encode("PDF bytes") });
            tx.objectStore("aiCredentials").put({ adapterId: "openai", apiKey: "must-not-export" });
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(new Error(tx.error?.message ?? "Transaction aborted"));
            tx.onerror = (event) => {
                if (event.target instanceof IDBRequest) {
                    reject(new Error(`${event.target.error?.name}: ${event.target.error?.message}`));
                }
            };
        });
        database.close();
    });
    await page.goto("/#/settings/backup");
    const pendingDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export backup" }).click();
    const download = await pendingDownload;
    const filename = await download.path();
    expect(filename).not.toBeNull();
    if (!filename) throw new Error("Backup download is missing.");
    const context = await browser.newContext();
    const restored = await context.newPage();
    await restored.goto("/#/settings/backup");
    await restored.getByLabel("Backup file", { exact: true }).setInputFiles(filename);
    await expect(restored.getByText("Backup restored. Reload to open the imported notes.")).toBeVisible();
    await restored.getByRole("button", { name: "Reload library" }).click();
    const contents = await restored.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("writeme");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const read = <T>(table: string): Promise<T[]> =>
            new Promise((resolve, reject) => {
                const request = database.transaction(table).objectStore(table).getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        const notes = await read<{ title: string; content: string }>("notes");
        const assets = await read<{ data: Uint8Array }>("pdfAssets");
        const credentials = await read<unknown>("aiCredentials");
        const bytes = new TextDecoder().decode(assets[0]?.data);
        database.close();
        return { notes, bytes, credentials };
    });
    expect(
        contents.notes.some((note) => note.title === "Backed up note" && note.content.includes("Keep this content")),
    ).toBe(true);
    expect(contents.bytes).toBe("PDF bytes");
    expect(contents.credentials).toEqual([]);
    await restored.getByLabel("Backup file", { exact: true }).setInputFiles(filename);
    await expect(restored.getByRole("alert").last()).toBeVisible();
    await context.close();
});

test("malformed backups show a recoverable error", async ({ page }) => {
    await page.goto("/#/settings/backup");
    await page.getByLabel("Backup file", { exact: true }).setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"notes":[]}'),
    });
    await expect(page.getByRole("alert").last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore backup" })).toBeEnabled();
});

test("exports live Markdown and saves it when backgrounded", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "Markdown note", "Raw original");
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await editor.fill("# Live Markdown\n\nCurrent edit");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export note", exact: true }).click();
    const filename = await (await pending).path();
    if (!filename) throw new Error("Exported note is missing.");
    expect(await readFile(filename, "utf8")).toBe("# Live Markdown\n\nCurrent edit");
    await page.evaluate(() => window.dispatchEvent(new Event("writeme:mobile-pause")));
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved");
    await page.reload();
    await expect(editor).toContainText("Current edit");
    await page.goto("/#/settings/backup");
    await expect(page.getByRole("button", { name: "Export note", exact: true })).toHaveCount(0);
});

test("Markdown import preserves handwritten note frontmatter", async ({ page }) => {
    await page.goto("/");
    const content =
        '---\ntype: freehand\nview: freehand\nschemaVersion: 1\n---\n\n```json\n{"version":1,"paper":"lined","pages":[{"strokes":[]}]}\n```\n';
    await page.getByLabel("Import Markdown file", { exact: true }).setInputFiles({
        name: "Notebook.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(content),
    });
    await expect(page.getByLabel("Handwritten notebook", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Handwritten notebook", { exact: true })).toBeVisible();
});
