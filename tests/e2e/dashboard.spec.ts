import { expect, goHome, test } from "./fixtures";

test.describe("Dashboard", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("renders the workspace dashboard and empty recent state", async ({ cleanPage: page }) => {
        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
        await expect(
            page
                .getByRole("main")
                .getByRole("button", { name: /^New note/ })
                .first(),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: /Find anything/ }).first()).toBeVisible();
        await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
        await expect(page.getByText("Start with one small thought.")).toBeVisible();
        await expect(
            page.getByText("Star the notes you return to often and they will stay one gesture away."),
        ).toBeVisible();
        await expect(page.getByText("No starred notes yet")).toBeVisible();
        await expect(page.getByRole("link", { name: "Browse notes" })).toBeVisible();
    });

    test("fits a narrow viewport without horizontal page overflow", async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
        await expect(page.getByRole("button", { name: /^New note/ }).last()).toBeVisible();
        await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible();

        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(documentWidth).toBeLessThanOrEqual(375);
    });

    test("New note quick action opens the create note dialog", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        await expect(page.getByRole("dialog", { name: /Create new note/i })).toBeVisible();
    });

    test("Start writing shortcut opens the create note dialog", async ({ cleanPage: page }) => {
        await page.getByRole("button", { name: "Start writing" }).click();
        await expect(page.getByRole("dialog", { name: /Create new note/i })).toBeVisible();
    });

    test("All notes link navigates to notes list", async ({ cleanPage: page }) => {
        await page.getByRole("link", { name: "All notes" }).click();
        await expect(page).toHaveURL(/\/notes$/);
        await expect(page.getByRole("heading", { name: "All Notes" })).toBeVisible();
    });
});
