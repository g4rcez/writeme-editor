import { createNote, expect, goHome, test } from "./fixtures";

const ORIGINAL_TITLE = "Rename test note";
const NEW_TITLE = "Renamed via double-click";

test.describe("Tab inline rename", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
        await createNote(cleanPage, ORIGINAL_TITLE);
        await expect(cleanPage.getByRole("textbox", { name: "Note editor", exact: true })).toHaveAttribute(
            "contenteditable",
            "true",
        );
        await expect(cleanPage.getByRole("textbox", { name: "Note editor", exact: true })).toBeFocused();
    });

    test("double-click tab opens rename input, Enter commits", async ({ cleanPage: page }) => {
        const tab = page.locator("[data-tab-id]").filter({ hasText: ORIGINAL_TITLE });
        const tabId = await tab.getAttribute("data-tab-id");
        await tab.getByText(ORIGINAL_TITLE, { exact: true }).dblclick();

        const renameInput = page.locator(`[data-tab-id="${tabId}"] input`);
        await expect(renameInput).toBeVisible();
        await expect(renameInput).toHaveValue(ORIGINAL_TITLE);

        await renameInput.fill(NEW_TITLE);
        await renameInput.press("Enter");

        await expect(renameInput).not.toBeVisible();
        await expect(page.locator("[data-tab-id]").filter({ hasText: NEW_TITLE })).toBeVisible();
        await page.reload();
        await expect(page.locator("[data-tab-id]")).toHaveText([NEW_TITLE]);
        await expect(
            page.getByRole("toolbar", { name: "Note tools" }).getByText(NEW_TITLE, { exact: true }),
        ).toBeVisible();
    });

    test("Escape cancels rename without saving", async ({ cleanPage: page }) => {
        const tab = page.locator("[data-tab-id]").filter({ hasText: ORIGINAL_TITLE });
        const tabId = await tab.getAttribute("data-tab-id");
        await tab.getByText(ORIGINAL_TITLE, { exact: true }).dblclick();

        const renameInput = page.locator(`[data-tab-id="${tabId}"] input`);
        await expect(renameInput).toBeVisible();
        await renameInput.fill("should not persist");
        await renameInput.press("Escape");

        await expect(renameInput).not.toBeVisible();
        await expect(page.locator("[data-tab-id]").filter({ hasText: ORIGINAL_TITLE })).toBeVisible();
        await page.reload();
        await expect(page.locator("[data-tab-id]")).toHaveText([ORIGINAL_TITLE]);
        await expect(
            page.getByRole("toolbar", { name: "Note tools" }).getByText(ORIGINAL_TITLE, { exact: true }),
        ).toBeVisible();
    });

    test("clicking outside the input commits the rename", async ({ cleanPage: page }) => {
        const tab = page.locator("[data-tab-id]").filter({ hasText: ORIGINAL_TITLE });
        const tabId = await tab.getAttribute("data-tab-id");
        await tab.getByText(ORIGINAL_TITLE, { exact: true }).dblclick();

        const renameInput = page.locator(`[data-tab-id="${tabId}"] input`);
        await expect(renameInput).toBeVisible();
        await renameInput.fill(NEW_TITLE);
        await page.locator(".ProseMirror").first().click();

        await expect(renameInput).not.toBeVisible();
        await expect(page.locator("[data-tab-id]").filter({ hasText: NEW_TITLE })).toBeVisible();
        await page.reload();
        await expect(page.locator("[data-tab-id]")).toHaveText([NEW_TITLE]);
        await expect(
            page.getByRole("toolbar", { name: "Note tools" }).getByText(NEW_TITLE, { exact: true }),
        ).toBeVisible();
    });
});
