import { createNote, goHome, test, expect } from "./fixtures";

test.describe("note history recovery", () => {
    test("previews versions side by side and preserves the current version when restoring", async ({
        cleanPage: page,
    }) => {
        await goHome(page);
        await createNote(page, "History recovery note", "First saved version");

        const editor = page.locator(".ProseMirror").first();
        await editor.click();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.type("Current version before restore");
        const saveStatus = page.locator(".writeme-editor-status-bar output").first();
        await expect(saveStatus).toHaveText("Unsaved changes");
        await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });

        await page.getByRole("button", { name: "History", exact: true }).click();
        const history = page.getByRole("dialog", { name: "Note history" });
        await expect(history).toBeVisible();
        const currentNote = history.getByRole("region", { name: "Current note" });
        const savedPreview = history.getByRole("region", { name: "Saved version preview" });
        await expect(currentNote).toContainText("Current version before restore");
        await expect(savedPreview).toContainText("Current version before restore");
        await expect(savedPreview.getByRole("textbox")).toHaveCount(0);
        await expect(savedPreview.locator("pre")).not.toHaveAttribute("contenteditable");

        const versions = history.getByRole("list", { name: "Saved versions" }).getByRole("button");
        await expect(versions).toHaveCount(3);
        await versions.nth(1).click();
        await expect(savedPreview).toContainText("First saved version");

        await savedPreview.getByRole("button", { name: "Restore" }).click();
        const confirmation = history.getByRole("group", { name: "Restore confirmation" });
        await expect(confirmation).toContainText("current content will be preserved in local history");
        await confirmation.getByRole("button", { name: "Restore" }).click();

        await expect(editor).toContainText("First saved version");
        await expect(currentNote).toContainText("First saved version");
        await expect(history.getByRole("list", { name: "Saved versions" }).getByRole("button")).toHaveCount(4);
        await history.getByRole("list", { name: "Saved versions" }).getByRole("button").nth(1).click();
        await expect(savedPreview).toContainText("Current version before restore");
    });
});
