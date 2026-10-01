import { expect, goHome, test } from "./fixtures";

test.use({ video: { mode: "on", size: { width: 1280, height: 800 } } });

test("README demo: create, write, and find a note", async ({ cleanPage: page }) => {
    const title = "A calmer morning";

    // Slow typing and short pauses keep each interaction clear in the recorded demo.
    await goHome(page);
    await page.waitForTimeout(900);
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();

    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await expect(dialog).toBeVisible();
    await dialog.getByTitle("Note title").pressSequentially(title, { delay: 70 });
    await page.waitForTimeout(400);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    const editor = page.getByRole("textbox", { name: "Note editor" });
    await expect(editor).toBeVisible();
    await page.waitForTimeout(700);
    await editor.click();
    await page.keyboard.type("Start with one clear idea.", { delay: 45 });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Write it down. Choose one next step.", { delay: 45 });
    await expect(editor).toContainText("Start with one clear idea.");
    await expect(editor).toContainText("Choose one next step.");
    await page.waitForTimeout(1300);

    await page.getByRole("button", { name: "All notes", exact: true }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole("heading", { name: "All Notes" })).toBeVisible();
    const noteLink = page.getByTestId("virtuoso-item-list").getByRole("link", { name: title });
    await expect(noteLink).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByPlaceholder("Search notes or tags...").pressSequentially("morning", { delay: 110 });
    await expect(noteLink).toBeVisible();
    await page.waitForTimeout(1200);
});
