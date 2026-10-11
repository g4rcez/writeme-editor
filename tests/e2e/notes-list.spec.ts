import { expect, goHome, test } from "./fixtures";

const seedNote = async (page: import("@playwright/test").Page, title: string) => {
    await page.goto("/notes");
    await expect(page.getByRole("heading", { name: "All notes" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+n");
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await expect(dialog).toBeVisible();
    await dialog.getByTitle("Note title").fill(title);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
};

test.describe("Notes list", () => {
    test("shows All notes heading and search input", async ({ cleanPage: page }) => {
        await goHome(page);
        await page.goto("/notes");
        await expect(page.getByRole("heading", { name: "All notes" })).toBeVisible();
        await expect(page.getByPlaceholder("Search notes or tags...")).toBeVisible();
        await expect(page.getByText("Create a note to get started.")).toBeVisible();
    });

    test("search filters the list to matching titles", async ({ cleanPage: page }) => {
        await seedNote(page, "Apple journal");
        await seedNote(page, "Banana ideas");

        await page.goto("/notes");
        const table = page.getByTestId("virtuoso-item-list");
        await expect(table.getByRole("link", { name: "Apple journal" })).toBeVisible();
        await expect(table.getByRole("link", { name: "Banana ideas" })).toBeVisible();

        await page.getByPlaceholder("Search notes or tags...").fill("Banana");
        await expect(table.getByRole("link", { name: "Banana ideas" })).toBeVisible();
        await expect(table.getByRole("link", { name: "Apple journal" })).toBeHidden();
    });

    test("explains how to recover from an empty search", async ({ cleanPage: page }) => {
        await seedNote(page, "Research notes");
        await page.goto("/notes");
        await expect(page.getByRole("columnheader", { name: "Tags", exact: true })).toBeVisible();
        await page.getByPlaceholder("Search notes or tags...").fill("missing");

        await expect(page.getByText("No notes found for “missing”.")).toBeVisible();
        await expect(page.getByText("Try another word or clear your search.")).toBeVisible();
        await page.getByRole("button", { name: "Clear search", exact: true }).click();
        await expect(page.getByRole("link", { name: "Research notes", exact: true })).toBeVisible();
    });

    test("explains that selected notes can be restored from Trash", async ({ cleanPage: page }) => {
        await seedNote(page, "First disposable note");
        await seedNote(page, "Second disposable note");
        await page.goto("/notes");
        await page.getByRole("button", { name: "Cards", exact: true }).click();
        await page.getByRole("checkbox", { name: "Select all notes" }).check();
        await page.getByRole("button", { name: "Move to Trash", exact: true }).last().click();

        const dialog = page.getByRole("dialog", { name: "Move 2 notes to Trash?" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("You can restore them from Trash.")).toBeVisible();
        await dialog.getByRole("button", { name: "Move to Trash", exact: true }).click();
        await expect(page.getByText("No notes yet.", { exact: true })).toBeVisible();
    });

    test("switches between table and cards while keeping search and selection", async ({ cleanPage: page }) => {
        await seedNote(page, "Apple journal");
        await seedNote(page, "Banana ideas");
        await page.goto("/notes");

        const tableButton = page.getByRole("button", { name: "Table", exact: true });
        const cardsButton = page.getByRole("button", { name: "Cards", exact: true });
        await expect(tableButton).toHaveAttribute("aria-pressed", "true");
        await cardsButton.click();
        await expect(cardsButton).toHaveAttribute("aria-pressed", "true");

        const cards = page.getByRole("list", { name: "Notes cards" });
        await expect(cards.getByRole("link", { name: "Apple journal" })).toBeVisible();
        await expect(cards.getByRole("link", { name: "Banana ideas" })).toBeVisible();
        await cards.getByRole("checkbox", { name: "Select Banana ideas" }).check();
        await expect(page.getByText("1 selected", { exact: true })).toBeVisible();

        await page.getByPlaceholder("Search notes or tags...").fill("Banana");
        await expect(cards.getByRole("link", { name: "Apple journal" })).toBeHidden();
        await expect(cards.getByRole("link", { name: "Banana ideas" })).toBeVisible();
        await tableButton.click();
        await expect(cards).toBeHidden();
        const table = page.getByTestId("virtuoso-item-list");
        await expect(table.getByRole("link", { name: "Banana ideas" })).toBeVisible();
        await expect(table.getByRole("link", { name: "Apple journal" })).toBeHidden();
        await expect(page.getByText("1 selected", { exact: true })).toBeVisible();

        await cardsButton.click();
        await expect(cards.getByRole("checkbox", { name: "Select Banana ideas" })).toBeChecked();
        await page.getByRole("button", { name: "Clear selection" }).click();
        await cards.getByRole("link", { name: "Banana ideas" }).click();
        await expect(page).toHaveURL(/\/note\/[^/]+$/);
    });

    test("cards support select all, group actions, and deletion on a narrow viewport", async ({ cleanPage: page }) => {
        await seedNote(page, "Disposable card");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/notes");
        await page.getByRole("button", { name: "Cards", exact: true }).click();
        const cards = page.getByRole("list", { name: "Notes cards" });
        await expect(cards.getByRole("link", { name: "Disposable card" })).toBeVisible();
        await page.getByRole("checkbox", { name: "Select all notes" }).check();
        await expect(cards.getByRole("checkbox", { name: "Select Disposable card" })).toBeChecked();
        await page.getByRole("checkbox", { name: "Select all notes" }).uncheck();
        await expect(cards.getByRole("checkbox", { name: "Select Disposable card" })).not.toBeChecked();

        await cards.getByRole("button", { name: "Add to group", exact: true }).click();
        const groupDialog = page.getByRole("dialog");
        await expect(groupDialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(groupDialog).toBeHidden();
        await cards.getByRole("button", { name: "Move to Trash", exact: true }).click();
        await expect(cards).toBeHidden();
        await expect(page.getByText(/moved to Trash/)).toBeVisible();
        await expect(page.getByText("No notes yet.", { exact: true })).toBeVisible();
    });

    test("delete row soft-deletes the note and shows undo toast", async ({ cleanPage: page }) => {
        await seedNote(page, "Disposable note");

        await page.goto("/notes");
        const table = page.getByTestId("virtuoso-item-list");
        const row = table.getByRole("link", { name: "Disposable note" });
        await expect(row).toBeVisible();

        await page.getByRole("button", { name: "Move to Trash" }).click();

        await expect(row).toBeHidden();
        await expect(page.getByText(/moved to Trash/)).toBeVisible();
    });
});
