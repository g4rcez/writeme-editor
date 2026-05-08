import { expect, goHome, test } from "./fixtures";

const NOTE_TITLE = "E2E test note";
const NOTE_BODY = "Hello from Playwright";

test.describe("Create note flow", () => {
  test.beforeEach(async ({ cleanPage }) => {
    await goHome(cleanPage);
  });

  test("creates a note from dialog and lands on the editor", async ({
    cleanPage: page,
  }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await expect(dialog).toBeVisible();

    const titleInput = dialog.getByTitle("Note title");
    await titleInput.fill(NOTE_TITLE);
    await dialog.getByRole("button", { name: /^Create/ }).click();

    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    await expect(dialog).toBeHidden();
    await expect(
      page.locator("[data-tab-id]").filter({ hasText: NOTE_TITLE }),
    ).toBeVisible();
  });

  test("typed content persists across reload", async ({ cleanPage: page }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(NOTE_TITLE);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.type(NOTE_BODY);
    await expect(editor).toContainText(NOTE_BODY);

    const noteUrl = page.url();
    // editor debounces saves at 500ms — wait for autosave flush before reload
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(page).toHaveURL(noteUrl);
    await expect(page.locator(".ProseMirror").first()).toContainText(NOTE_BODY);
  });

  test("dialog blocks submission when title is empty", async ({
    cleanPage: page,
  }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill("");
    await dialog.getByRole("button", { name: /^Create/ }).click();

    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("created note appears in the dashboard recent list", async ({
    cleanPage: page,
  }) => {
    await page.getByRole("button", { name: /New Document/ }).click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(NOTE_TITLE);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);

    await page.goto("/notes");
    await expect(
      page.getByRole("link", { name: new RegExp(NOTE_TITLE) }).first(),
    ).toBeVisible();
  });
});
