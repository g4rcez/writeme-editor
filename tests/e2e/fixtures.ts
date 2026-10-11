import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend<{ cleanPage: Page }>({
    cleanPage: async ({ page }, use) => {
        await use(page);
    },
});

export const goHome = async (page: Page) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible({ timeout: 30_000 });
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
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    if (content) {
        const editor = page.locator(".ProseMirror").first();
        await expect(editor).toBeVisible();
        await expect(editor).toHaveAttribute("contenteditable", "true");
        await editor.click();
        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await editor.pressSequentially(content.slice(0, 1));
        await expect(saveStatus).toHaveText("Unsaved changes");
        await editor.pressSequentially(content.slice(1));
        const expectedContent = (await editor.innerText()).trim();
        expect(expectedContent).not.toBe("");
        const noteUrl = page.url();
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
        await page.reload();
        await expect(page).toHaveURL(noteUrl);
        await expect(page.locator(".ProseMirror").first()).toContainText(expectedContent);
    }

    return page.url();
};

export { expect };
