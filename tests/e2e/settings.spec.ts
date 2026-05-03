import { expect, goHome, test } from "./fixtures";

test.describe("Settings", () => {
  test.beforeEach(async ({ cleanPage }) => {
    await goHome(cleanPage);
  });

  test("page renders core sections", async ({ cleanPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Autosave", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save Changes/ }),
    ).toBeVisible();
  });

  test("theme toggle swaps dark class on <html>", async ({
    cleanPage: page,
  }) => {
    const html = page.locator("html");
    // default theme is dark
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  });
});
