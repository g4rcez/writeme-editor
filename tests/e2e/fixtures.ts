import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend<{ cleanPage: Page }>({
    cleanPage: async ({ page }, use) => {
        await use(page);
    },
});

export const goHome = async (page: Page) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible({ timeout: 30_000 });
};

export const createNote = async (page: Page, title: string, content = ""): Promise<string> => {
    const previousUrl = page.url();
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(title);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL((url) => /\/note\/[^/]+$/.test(url.pathname) && url.href !== previousUrl);
    const noteId = new URL(page.url()).pathname.slice("/note/".length);
    const editor = page.locator(`#editor-container-${noteId} .ProseMirror`);
    await expect(editor).toBeVisible({ timeout: 30_000 });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toHaveAttribute("aria-busy", "false");

    if (content) {
        await editor.fill(content);
        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await expect(saveStatus).toHaveText("Unsaved changes");
        await editor.press("ControlOrMeta+s");
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
    }

    return page.url();
};

export { expect };
