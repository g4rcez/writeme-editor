import { createNote, expect, goHome, test } from "./fixtures";

const tabSelector = "[data-tab-id]";

test.describe("Note tab lifecycle", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("opening an existing note reuses its tab without changing tab order", async ({ cleanPage: page }) => {
        const firstUrl = await createNote(page, "First document");
        const secondUrl = await createNote(page, "Second document");
        const tabs = page.locator(tabSelector);
        await expect(tabs).toHaveText(["First document", "Second document"]);
        const firstTabId = await tabs.first().getAttribute("data-tab-id");

        if (!firstTabId) throw new Error("Expected the first document tab to have an ID.");
        await page
            .getByRole("list", { name: "Notes", exact: true })
            .getByRole("button", { name: /^First document / })
            .click();
        await expect(page).toHaveURL(firstUrl);
        await expect(tabs).toHaveText(["First document", "Second document"]);
        await expect(tabs.first()).toHaveAttribute("data-tab-id", firstTabId);
        await expect(tabs.first()).toHaveAttribute("aria-current", "page");

        await tabs.filter({ hasText: "Second document" }).click();
        await expect(page).toHaveURL(secondUrl);
        await page.reload();
        await expect(tabs).toHaveText(["First document", "Second document"]);
        await expect(tabs.last()).toHaveAttribute("aria-current", "page");
    });

    test("closing a background tab leaves the active note intact and stays closed after reload", async ({
        cleanPage: page,
    }) => {
        await createNote(page, "Background document", "Background content remains saved.");
        const activeUrl = await createNote(page, "Active document", "Active content must not be replaced.");
        const tabs = page.locator(tabSelector);

        await page.getByRole("button", { name: "Close Background document", exact: true }).click();
        await expect(tabs).toHaveText(["Active document"]);
        await expect(page).toHaveURL(activeUrl);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Active content must not be replaced.",
        );
        await expect(tabs.first()).toHaveAttribute("aria-current", "page");

        await page.reload();
        await expect(tabs).toHaveText(["Active document"]);
        await expect(page).toHaveURL(activeUrl);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Active content must not be replaced.",
        );
    });

    test("closing the active tab selects its predecessor, then the remaining neighbor", async ({ cleanPage: page }) => {
        test.setTimeout(120_000);
        const firstUrl = await createNote(page, "First neighbor", "First neighbor content.");
        const middleUrl = await createNote(page, "Middle document", "Middle document content.");
        const lastUrl = await createNote(page, "Last neighbor", "Last neighbor content.");
        const tabs = page.locator(tabSelector);
        await tabs.filter({ hasText: "Middle document" }).click();
        await expect(page).toHaveURL(middleUrl);
        await expect(tabs.filter({ hasText: "Middle document" })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Middle document content.",
        );

        await page.getByRole("button", { name: "Close Middle document", exact: true }).click();
        await expect(tabs).toHaveText(["First neighbor", "Last neighbor"]);
        await expect(page).toHaveURL(firstUrl);
        await expect(tabs.first()).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "First neighbor content.",
        );

        await page.keyboard.press("ControlOrMeta+W");
        await expect(tabs).toHaveText(["Last neighbor"]);
        await expect(page).toHaveURL(lastUrl);
        await expect(tabs.first()).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Last neighbor content.",
        );
        await page.reload();
        await expect(tabs).toHaveText(["Last neighbor"]);
        await expect(page).toHaveURL(lastUrl);
    });

    test("closing the last tab returns home without deleting the saved note", async ({ cleanPage: page }) => {
        const noteUrl = await createNote(page, "Keep this document", "Closing a tab must not delete this content.");
        const tabs = page.locator(tabSelector);
        await page.getByRole("button", { name: "Close Keep this document", exact: true }).click();
        await expect(tabs).toHaveCount(0);
        await expect(page).toHaveURL("/");
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();

        await page.reload();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await expect(tabs).toHaveCount(0);
        await page
            .getByRole("list", { name: "Notes", exact: true })
            .getByRole("button", { name: /^Keep this document / })
            .click();
        await expect(page).toHaveURL(noteUrl);
        await expect(tabs).toHaveText(["Keep this document"]);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Closing a tab must not delete this content.",
        );
    });

    test("restores the tab set and independent note contents after reload and a fresh page", async ({
        cleanPage: page,
        context,
    }) => {
        test.setTimeout(120_000);
        const firstUrl = await createNote(page, "Persistent first", "Only the first document owns this text.");
        const secondUrl = await createNote(page, "Persistent second", "Only the second document owns this text.");
        const tabs = page.locator(tabSelector);
        await tabs.filter({ hasText: "Persistent first" }).click();
        await expect(page).toHaveURL(firstUrl);
        await page.reload();
        await expect(tabs).toHaveText(["Persistent first", "Persistent second"]);
        await expect(tabs.first()).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Only the first document owns this text.",
        );

        const reopened = await context.newPage();
        await page.close();
        await reopened.goto(secondUrl);
        await expect(reopened.locator(tabSelector)).toHaveText(["Persistent first", "Persistent second"]);
        await expect(reopened.locator(tabSelector).last()).toHaveAttribute("aria-current", "page");
        await expect(reopened.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Only the second document owns this text.",
        );
        await reopened.locator(tabSelector).filter({ hasText: "Persistent first" }).click();
        await expect(reopened).toHaveURL(firstUrl);
        await expect(reopened.getByRole("textbox", { name: "Note editor", exact: true })).toHaveText(
            "Only the first document owns this text.",
        );
        await reopened.close();
    });
});
