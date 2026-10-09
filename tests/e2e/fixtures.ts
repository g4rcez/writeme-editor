import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend<{ cleanPage: Page }>({
    cleanPage: async ({ page }, use) => {
        await use(page);
    },
});

export const goHome = async (page: Page) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
};

export const createNote = async (page: Page, title: string, content = ""): Promise<string> => {
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(title);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    if (content) {
        const editor = page.locator(".ProseMirror").first();
        await expect(editor).toBeVisible();
        await editor.click();
        await editor.pressSequentially(content);
        const expectedContent = (await editor.innerText()).trim();
        expect(expectedContent).not.toBe("");
        const noteUrl = page.url();
        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await expect(saveStatus).toHaveText("Unsaved changes");
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
        await page.reload();
        await expect(page).toHaveURL(noteUrl);
        await expect(page.locator(".ProseMirror").first()).toContainText(expectedContent);
    }

    return page.url();
};

export { expect };
