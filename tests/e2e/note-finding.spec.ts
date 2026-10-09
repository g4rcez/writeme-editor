import { createNote, goHome, test, expect } from "./fixtures";

test.describe("note content search", () => {
    test("finds note text, shows an excerpt, and opens a result with the keyboard", async ({ cleanPage: page }) => {
        await goHome(page);
        const noteUrl = await createNote(
            page,
            "Searchable field note",
            "A quiet morning began with the indigo lantern above the river.",
        );

        await page.getByRole("button", { name: "Search", exact: true }).click();
        const searchInput = page.getByTitle("Search notes");
        await expect(searchInput).toBeFocused();
        await searchInput.fill("indigo lantern");

        const result = page.getByRole("button", { name: /^Searchable field note A quiet/ });
        await expect(result).toContainText("indigo lantern above the river");
        await expect(result).toContainText("Local note");

        await searchInput.fill("phrase not present in any note");
        await expect(page.getByText("No notes match")).toBeVisible();
        await expect(result).toHaveCount(0);

        await searchInput.fill("indigo lantern");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(noteUrl);
    });
});
