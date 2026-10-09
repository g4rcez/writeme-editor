import { goHome, test, expect } from "./fixtures";

test.describe("daily quick capture", () => {
    test("applies a template once and reopens the same daily note without replacing edits", async ({
        cleanPage: page,
    }) => {
        await goHome(page);
        await page.goto("/settings/templates");
        await page.getByRole("button", { name: "New Template" }).click();

        const templateDialog = page.getByRole("dialog", { name: "Create new template" });
        await templateDialog.getByTitle("Template Name").fill("Daily capture template");
        await templateDialog.getByRole("button", { name: "Create" }).click();
        await expect(page).toHaveURL(/\/templates\/[^/]+$/);

        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
        await page.getByRole("main", { name: "Home" }).getByRole("button", { name: "Open note", exact: true }).click();
        await page.getByText("Open today's note", { exact: true }).click();

        const quickNoteDialog = page.getByRole("dialog", { name: "Today's quick note" });
        const templateSelector = quickNoteDialog.getByRole("combobox", { name: "From Template (Optional)" });
        await templateSelector.fill("Daily capture template");
        await page.getByRole("option", { name: "Daily capture template", exact: true }).click();
        await quickNoteDialog.getByTitle("content").fill("Template body");
        await quickNoteDialog.getByRole("button", { name: "Open today's note" }).click();
        await expect(page).toHaveURL(/\/quicknote\/[^/]+$/);

        const quickNoteUrl = page.url();
        const noteId = quickNoteUrl.match(/\/quicknote\/([^/]+)$/)?.[1];
        if (!noteId) throw new Error("Daily note route did not include a note ID.");
        const editor = page.locator(".ProseMirror").first();
        await expect(editor).toContainText("Daily capture template");
        await expect(editor).toContainText("Template body");
        await editor.locator("p").last().click();
        await page.keyboard.press("End");
        await page.keyboard.type(" User addition");

        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
        await page.reload();
        await expect(page.locator(".ProseMirror").first()).toContainText("Template body");
        await expect(page.locator(".ProseMirror").first()).toContainText("User addition");

        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
        await page.getByRole("main", { name: "Home" }).getByRole("button", { name: "Open note", exact: true }).click();
        await page.getByText("Open today's note", { exact: true }).click();
        await expect(page).toHaveURL(new URL(`/note/${noteId}`, page.url()).href);
        await expect(page.locator(".ProseMirror").first()).toContainText("Template body");
        await expect(page.locator(".ProseMirror").first()).toContainText("User addition");
    });
});
