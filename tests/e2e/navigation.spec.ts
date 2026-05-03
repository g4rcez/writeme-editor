import { expect, goHome, test } from "./fixtures";

test.describe("Navigation", () => {
  test.beforeEach(async ({ cleanPage }) => {
    await goHome(cleanPage);
  });

  test("View all link goes to notes list", async ({ cleanPage: page }) => {
    await page.getByRole("link", { name: /View all/ }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(
      page.getByRole("heading", { name: "All Notes" }),
    ).toBeVisible();
  });

  test("direct URLs render core pages", async ({ cleanPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.goto("/tags");
    await expect(page).toHaveURL(/\/tags$/);

    await page.goto("/read-it-later");
    await expect(page).toHaveURL(/\/read-it-later$/);
  });

  test("create-note dialog closes on Escape", async ({ cleanPage: page }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("global ⌘N opens the create note dialog from any page", async ({
    cleanPage: page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+n");
    await expect(
      page.getByRole("dialog", { name: /Create new note/i }),
    ).toBeVisible();
  });
});
