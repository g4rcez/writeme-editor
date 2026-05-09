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
});
