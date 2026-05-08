import { expect, goHome, test } from "./fixtures";

const ORIGINAL_TITLE = "Rename test note";
const NEW_TITLE = "Renamed via double-click";

test.describe("Tab inline rename", () => {
  test.beforeEach(async ({ cleanPage }) => {
    await goHome(cleanPage);
  });

  test("double-click tab opens rename input, Enter commits", async ({
    cleanPage: page,
  }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(ORIGINAL_TITLE);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    const tab = page
      .locator("[data-tab-id]")
      .filter({ hasText: ORIGINAL_TITLE });
    const tabId = await tab.getAttribute("data-tab-id");
    await tab.dblclick();

    const renameInput = page.locator(`[data-tab-id="${tabId}"] input`);
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toHaveValue(ORIGINAL_TITLE);

    await renameInput.fill(NEW_TITLE);
    await renameInput.press("Enter");

    await expect(renameInput).not.toBeVisible();
    await expect(
      page.locator("[data-tab-id]").filter({ hasText: NEW_TITLE }),
    ).toBeVisible();
  });

  test("Escape cancels rename without saving", async ({ cleanPage: page }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(ORIGINAL_TITLE);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    const tab = page
      .locator("[data-tab-id]")
      .filter({ hasText: ORIGINAL_TITLE });
    const tabId = await tab.getAttribute("data-tab-id");
    await tab.dblclick();

    const renameInput = page.locator(`[data-tab-id="${tabId}"] input`);
    await expect(renameInput).toBeVisible();
    await renameInput.fill("should not persist");
    await renameInput.press("Escape");

    await expect(renameInput).not.toBeVisible();
    await expect(
      page.locator("[data-tab-id]").filter({ hasText: ORIGINAL_TITLE }),
    ).toBeVisible();
  });

  test("clicking outside the input commits the rename", async ({
    cleanPage: page,
  }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(ORIGINAL_TITLE);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    const tab = page
      .locator("[data-tab-id]")
      .filter({ hasText: ORIGINAL_TITLE });
    const tabId = await tab.getAttribute("data-tab-id");
    await tab.dblclick();

    const renameInput = page.locator(`[data-tab-id="${tabId}"] input`);
    await expect(renameInput).toBeVisible();
    await renameInput.fill(NEW_TITLE);
    await page.locator(".ProseMirror").first().click();

    await expect(renameInput).not.toBeVisible();
    await expect(
      page.locator("[data-tab-id]").filter({ hasText: NEW_TITLE }),
    ).toBeVisible();
  });
});
