import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const createNote = async (page: Page, title: string) => {
  await page.keyboard.press("ControlOrMeta+n");
  const dialog = page.getByRole("dialog", { name: /Create new note/i });
  await expect(dialog).toBeVisible();
  await dialog.getByTitle("Note title").fill(title);
  await dialog.getByRole("button", { name: /^Create/ }).click();
  await expect(page).toHaveURL(/\/note\/[^/]+$/);
  await page.goto("/notes");
};

const openTrashPane = async (page: Page) => {
  await page.getByRole("button", { name: "Trash" }).click();
};

test.describe("Trash / soft-delete", () => {
  test.beforeEach(async ({ cleanPage }) => {
    await cleanPage.goto("/");
    await expect(cleanPage.getByText("Quick settings")).toBeVisible();
  });

  test("deleting a note moves it to trash and hides it from the list", async ({
    cleanPage: page,
  }) => {
    await createNote(page, "Note to trash");

    await page.goto("/notes");
    const row = page
      .getByTestId("virtuoso-item-list")
      .getByRole("link", { name: "Note to trash" });
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "Delete note" }).click();

    await expect(row).toBeHidden();
    await expect(page.getByText(/moved to Trash/)).toBeVisible();
  });

  test("undo toast restores the note to the list", async ({
    cleanPage: page,
  }) => {
    await createNote(page, "Note to undo");

    await page.goto("/notes");
    await page.getByRole("button", { name: "Delete note" }).click();

    const undoButton = page.getByRole("button", { name: "Undo" });
    await expect(undoButton).toBeVisible();
    await undoButton.click();

    await expect(
      page
        .getByTestId("virtuoso-item-list")
        .getByRole("link", { name: "Note to undo" }),
    ).toBeVisible();
  });

  test("deleted note appears in the Trash pane", async ({
    cleanPage: page,
  }) => {
    await createNote(page, "Trashed note");

    await page.goto("/notes");
    await page.getByRole("button", { name: "Delete note" }).click();
    await expect(
      page
        .getByTestId("virtuoso-item-list")
        .getByRole("link", { name: "Trashed note" }),
    ).toBeHidden();

    await openTrashPane(page);
    await expect(page.getByText("Trashed note")).toBeVisible();
  });

  test("restore from Trash pane returns note to all-notes list", async ({
    cleanPage: page,
  }) => {
    await createNote(page, "Restorable note");

    await page.goto("/notes");
    await page.getByRole("button", { name: "Delete note" }).click();

    await openTrashPane(page);
    await expect(page.getByText("Restorable note")).toBeVisible();

    const row = page.locator(".group", { hasText: "Restorable note" });
    await row.hover();
    await row.getByTitle("Restore").click();

    await expect(page.getByText("Restorable note")).toBeHidden();

    await page.getByRole("button", { name: "Explorer" }).click();
    await page.goto("/notes");
    await expect(
      page
        .getByTestId("virtuoso-item-list")
        .getByRole("link", { name: "Restorable note" }),
    ).toBeVisible();
  });

  test("Delete permanently button is absent from Trash pane", async ({
    cleanPage: page,
  }) => {
    await createNote(page, "No permanent delete");

    await page.goto("/notes");
    await page.getByRole("button", { name: "Delete note" }).click();

    await openTrashPane(page);

    const row = page.locator(".group", { hasText: "No permanent delete" });
    await row.hover();
    await expect(page.getByTitle("Delete permanently")).toHaveCount(0);
  });

  test("Empty Trash removes all trashed notes", async ({ cleanPage: page }) => {
    await createNote(page, "Trash item one");
    await page.goto("/notes");
    await page.getByRole("button", { name: "Delete note" }).click();

    await page.goto("/");
    await createNote(page, "Trash item two");
    await page.goto("/notes");
    const buttons = page.getByRole("button", { name: "Delete note" });
    await buttons.first().click();

    await openTrashPane(page);
    await expect(page.getByText("Trash item one")).toBeVisible();
    await expect(page.getByText("Trash item two")).toBeVisible();

    await page.getByRole("button", { name: "Empty Trash" }).click();
    const confirmDialog = page.getByRole("dialog", { name: /Empty Trash/i });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Empty Trash" }).click();

    await expect(page.getByText("Trash is empty")).toBeVisible();
  });
});
