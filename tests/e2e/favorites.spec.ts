import { createNote, expect, goHome, test } from "./fixtures";

test.describe("Favorites", () => {
    test("favorites a note from its header and removes it from the favorites list", async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Favorite workflow note");

        const addToFavorites = page.getByRole("button", { name: "Add to favorites" });
        await expect(addToFavorites).toBeVisible();
        await expect(addToFavorites).toHaveAttribute("aria-pressed", "false");
        await addToFavorites.click();

        const removeFromFavorites = page.getByRole("button", { name: "Remove from favorites" });
        await expect(removeFromFavorites).toBeVisible();
        await expect(removeFromFavorites).toHaveAttribute("aria-pressed", "true");

        await page.reload();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);
        await expect(page.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );

        await page
            .getByRole("navigation", { name: "Workspace navigation" })
            .getByRole("button", { name: "Favorites" })
            .click();
        const removeFromList = page.getByRole("button", { name: "Unstar Favorite workflow note" });
        await expect(removeFromList).toBeVisible();
        await expect(removeFromList).toHaveAttribute("aria-pressed", "true");
        await removeFromList.click();

        await expect(page.getByText("No favorites yet")).toBeVisible();
        await expect(page.getByRole("button", { name: "Browse notes" })).toBeVisible();
    });
});
