import { expect, goHome, test } from "./fixtures";

const seedNote = async (
  page: import("@playwright/test").Page,
  title: string,
) => {
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "All Notes" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+n");
  const dialog = page.getByRole("dialog", { name: /Create new note/i });
  await expect(dialog).toBeVisible();
  await dialog.getByTitle("Note title").fill(title);
  await dialog.getByRole("button", { name: /^Create/ }).click();
  await expect(page).toHaveURL(/\/note\/[^/]+$/);
};

test.describe("Notes list", () => {
  test("shows All Notes heading and search input", async ({
    cleanPage: page,
  }) => {
    await goHome(page);
    await page.goto("/notes");
    await expect(
      page.getByRole("heading", { name: "All Notes" }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Search notes or tags..."),
    ).toBeVisible();
  });

  test("search filters the list to matching titles", async ({
    cleanPage: page,
  }) => {
    await seedNote(page, "Apple journal");
    await seedNote(page, "Banana ideas");

    await page.goto("/notes");
    const table = page.getByTestId("virtuoso-item-list");
    await expect(
      table.getByRole("link", { name: "Apple journal" }),
    ).toBeVisible();
    await expect(
      table.getByRole("link", { name: "Banana ideas" }),
    ).toBeVisible();

    await page.getByPlaceholder("Search notes or tags...").fill("Banana");
    await expect(
      table.getByRole("link", { name: "Banana ideas" }),
    ).toBeVisible();
    await expect(
      table.getByRole("link", { name: "Apple journal" }),
    ).toBeHidden();
  });

  test("delete row soft-deletes the note and shows undo toast", async ({
    cleanPage: page,
  }) => {
    await seedNote(page, "Disposable note");

    await page.goto("/notes");
    const table = page.getByTestId("virtuoso-item-list");
    const row = table.getByRole("link", { name: "Disposable note" });
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "Delete note" }).click();

    await expect(row).toBeHidden();
    await expect(page.getByText(/moved to Trash/)).toBeVisible();
  });
});
