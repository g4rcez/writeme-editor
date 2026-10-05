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
        await expect(page.locator(".writeme-editor-status-bar output")).toHaveText("Saved", { timeout: 10_000 });
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
