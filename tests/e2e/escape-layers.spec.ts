import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("WRITEME_UI_SETTINGS", JSON.stringify({ sidebarOpen: false }));
        window.close = () => {
            document.documentElement.dataset.windowCloseCount = String(
                Number(document.documentElement.dataset.windowCloseCount ?? 0) + 1,
            );
        };
    });
});

for (const route of ["floating-editor", "quicknote", "mathnote"]) {
    test(`${route}: Escape dismisses a dialog before closing the window`, async ({ page }) => {
        await page.goto(`/${route}`);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
        await page.keyboard.press("Control+f");
        const find = page.getByRole("textbox", { name: "Find text", exact: true });
        await expect(find).toBeVisible();
        await page.getByRole("main").getByRole("button", { name: "New note", exact: true }).first().click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(find).toBeVisible();
        await expect(page.locator("html")).not.toHaveAttribute("data-window-close-count");
        await page.keyboard.press("Escape");
        await expect(find).toBeHidden();
        await expect(page.locator("html")).not.toHaveAttribute("data-window-close-count");
        await page.getByRole("textbox", { name: "Note editor", exact: true }).click();
        await page.evaluate(() => {
            window.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
        });
        await page.keyboard.press("Escape");
        await expect(page.locator("html")).not.toHaveAttribute("data-window-close-count");
        await page.keyboard.press("Escape");
        await expect(page.locator("html")).toHaveAttribute("data-window-close-count", "1");
    });
}

for (const route of ["floating-editor", "quicknote"]) {
    test(`${route}: Escape closes completion before the window`, async ({ page }) => {
        await page.goto(`/${route}`);
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await editor.click();
        await page.keyboard.type("## Local section");
        await page.keyboard.press("Enter");
        await page.keyboard.type("Reference #Lo");
        await page.keyboard.press("Control+Space");
        const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
        await expect(menu).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
        await expect(page.locator("html")).not.toHaveAttribute("data-window-close-count");
        await page.keyboard.press("Escape");
        await expect(page.locator("html")).toHaveAttribute("data-window-close-count", "1");
    });
}
