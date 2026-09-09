import { expect, goHome, test } from "./fixtures";

test.describe("Settings", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("page renders core sections", async ({ cleanPage: page }) => {
        await page.goto("/settings/editor");
        await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
        await expect(page.getByText("Autosave", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Save Editor/ })).toBeVisible();
    });
});
