import { expect, goHome, test } from "./fixtures";

test.describe("Recently closed tabs", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("Cmd/Ctrl+Shift+T restores the most recently closed note tab", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill("Restorable tab");
        await dialog.getByRole("button", { name: /^Create/ }).click();

        const noteUrl = page.url();
        const tab = page.locator("[data-tab-id]").filter({ hasText: "Restorable tab" });
        await expect(tab).toBeVisible();
        await page.keyboard.press("ControlOrMeta+W");
        await expect(tab).toHaveCount(0);
        await expect(page).toHaveURL("/");

        await page.keyboard.press("ControlOrMeta+Shift+T");

        await expect(page).toHaveURL(noteUrl);
        await expect(tab).toBeVisible();
    });
});
