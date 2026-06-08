import { expect, goHome, test } from "./fixtures";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ cleanPage }) => {
    await goHome(cleanPage);
  });

  test("renders Quick settings and empty recent state", async ({
    cleanPage: page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Quick settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /New Document/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Quick Search/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent Documents" }),
    ).toBeVisible();
    await expect(
      page.getByText("No documents found. Start by creating one!"),
    ).toBeVisible();
    await expect(
      page.getByText("Mark notes as favorites to see them here."),
    ).toBeVisible();
  });

  test("New Document quick action opens the create note dialog", async ({
    cleanPage: page,
  }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    await expect(
      page.getByRole("dialog", { name: /Create new note/i }),
    ).toBeVisible();
  });

  test("View all link navigates to notes list", async ({ cleanPage: page }) => {
    await page.getByRole("link", { name: /View all/ }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(
      page.getByRole("heading", { name: "All Notes" }),
    ).toBeVisible();
  });
});
