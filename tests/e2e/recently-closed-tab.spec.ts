import { createNote, expect, goHome, test } from "./fixtures";

test.describe("Recently closed tabs", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("Cmd/Ctrl+Shift+T restores the most recently closed note tab", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill("Restorable tab");
        await dialog.getByRole("button", { name: /^Create/ }).click();

        const noteUrl = page.url();
        const tab = page.locator("[data-tab-id]").filter({ hasText: "Restorable tab" });
        await expect(tab).toBeVisible();
        await page.keyboard.press("ControlOrMeta+W");
        await expect(tab).toHaveCount(0);
        await expect(page).toHaveURL("/");

        await page.keyboard.press("ControlOrMeta+Shift+T");

        await expect(page).toHaveURL(noteUrl);
        await expect(tab).toBeVisible();
    });

    test("restores multiple closed tabs in reverse closing order with their saved content", async ({
        cleanPage: page,
    }) => {
        const firstUrl = await createNote(page, "First closed", "First closed document content.");
        const secondUrl = await createNote(page, "Second closed", "Second closed document content.");
        const thirdUrl = await createNote(page, "Still open", "The remaining document content.");
        const tabs = page.locator("[data-tab-id]");

        await page.getByRole("button", { name: "Close First closed", exact: true }).click();
        await expect(tabs).toHaveText(["Second closed", "Still open"]);
        await page.getByRole("button", { name: "Close Second closed", exact: true }).click();
        await expect(tabs).toHaveText(["Still open"]);
        await expect(page).toHaveURL(thirdUrl);

        await page.keyboard.press("ControlOrMeta+Shift+T");
        await expect(page).toHaveURL(secondUrl);
        await expect(tabs).toHaveText(["Still open", "Second closed"]);
        await expect(tabs.last()).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Second closed document content.",
        );

        await page.keyboard.press("ControlOrMeta+Shift+T");
        await expect(page).toHaveURL(firstUrl);
        await expect(tabs).toHaveText(["Still open", "Second closed", "First closed"]);
        await expect(tabs.last()).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "First closed document content.",
        );

        await page.keyboard.press("ControlOrMeta+Shift+T");
        await expect(page).toHaveURL(firstUrl);
        await expect(tabs).toHaveText(["Still open", "Second closed", "First closed"]);
        await page.reload();
        await expect(tabs).toHaveText(["Still open", "Second closed", "First closed"]);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "First closed document content.",
        );
    });

    test("restoring a manually reopened note does not create a duplicate tab", async ({ cleanPage: page }) => {
        const noteUrl = await createNote(page, "Already reopened", "Saved content survives reopening.");
        await createNote(page, "Other document");
        const tabs = page.locator("[data-tab-id]");
        await page.getByRole("button", { name: "Close Already reopened", exact: true }).click();
        await expect(tabs).toHaveText(["Other document"]);

        await page
            .getByRole("list", { name: "Notes", exact: true })
            .getByRole("button", { name: /^Already reopened / })
            .click();
        await expect(page).toHaveURL(noteUrl);
        await expect(tabs).toHaveText(["Other document", "Already reopened"]);
        await tabs.filter({ hasText: "Other document" }).click();
        await expect(
            page.getByRole("toolbar", { name: "Note tools" }).getByText("Other document", { exact: true }),
        ).toBeVisible();

        await page.keyboard.press("ControlOrMeta+Shift+T");
        await expect(page).toHaveURL(noteUrl);
        await expect(tabs).toHaveText(["Other document", "Already reopened"]);
        await expect(tabs.last()).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Saved content survives reopening.",
        );
        await page.reload();
        await expect(tabs).toHaveText(["Other document", "Already reopened"]);
    });
});
