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

        await page.getByRole("button", { name: "Go to home", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page
            .getByRole("main", { name: "Home" })
            .getByRole("button", { name: "Find a note", exact: true })
            .first()
            .click();
        await page.getByText("Open today's note", { exact: true }).click();

        const quickNoteDialog = page.getByRole("dialog", { name: "Today's quick note" });
        const templateSelector = quickNoteDialog.getByRole("combobox", { name: "Template (optional)" });
        await templateSelector.fill("Daily capture template");
        await page.getByRole("option", { name: "Daily capture template", exact: true }).click();
        await quickNoteDialog.getByTitle("content").fill("Template body");
        await quickNoteDialog.getByRole("button", { name: "Open today's note" }).click();
        await expect(page).toHaveURL(/\/quicknote\/[^/]+$/);

        const quickNoteUrl = page.url();
        const noteId = quickNoteUrl.match(/\/quicknote\/([^/]+)$/)?.[1];
        if (!noteId) throw new Error("Daily note route did not include a note ID.");
        const editor = page.locator(`#editor-container-${noteId} .ProseMirror`);
        await expect(editor).toBeVisible({ timeout: 30_000 });
        await expect(editor).toHaveAttribute("contenteditable", "true");
        await expect(editor).toHaveAttribute("aria-busy", "false");
        await expect(editor).toContainText("Daily capture template");
        await expect(editor).toContainText("Template body");
        await editor.locator("p").last().click();
        await page.keyboard.press("End");
        await page.keyboard.type(" User addition");
        await expect(editor).toContainText("User addition");

        const saveStatus = page.getByRole("status", { name: "Note save status" });
        await expect(saveStatus).toHaveText("Unsaved changes");
        await editor.press("ControlOrMeta+s");
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
        await page.reload();
        await expect(editor).toBeVisible({ timeout: 30_000 });
        await expect(editor).toHaveAttribute("contenteditable", "true");
        await expect(editor).toHaveAttribute("aria-busy", "false");
        await expect(editor).toContainText("Template body");
        await expect(editor).toContainText("User addition");

        await page.getByRole("button", { name: "Go to home", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page
            .getByRole("main", { name: "Home" })
            .getByRole("button", { name: "Find a note", exact: true })
            .first()
            .click();
        await page.getByText("Open today's note", { exact: true }).click();
        await expect(editor).toBeVisible({ timeout: 30_000 });
        await expect(editor).toHaveAttribute("contenteditable", "true");
        await expect(editor).toHaveAttribute("aria-busy", "false");
        await expect(editor).toContainText("Template body");
        await expect(editor).toContainText("User addition");
    });
});
