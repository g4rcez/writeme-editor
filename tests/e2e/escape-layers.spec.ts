import { createNote, expect, goHome, test } from "./fixtures";

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

test("Escape dismisses the selection toolbar in the main editor", async ({ page }) => {
    await goHome(page);
    await createNote(page, "Selection toolbar dismissal");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("Keep this text selected");
    await page.keyboard.press("ControlOrMeta+a");
    const toolbar = page.getByRole("toolbar", { name: "Formatting toolbar" });
    await expect(toolbar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toolbar).toBeHidden();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("Keep this text selected");
    await expect(page.locator("html")).not.toHaveAttribute("data-window-close-count");
});

test("Control+Escape closes the floating window while the command palette is open", async ({ page }) => {
    await page.goto("/floating-editor");
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
    await page.keyboard.press("Control+Shift+p");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Control+Escape");
    await expect(page.locator("html")).toHaveAttribute("data-window-close-count", "1");
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
    test(`${route}: Escape dismisses the selection toolbar and a new selection restores it`, async ({ page }) => {
        await page.goto(`/${route}`);
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await editor.click();
        await page.keyboard.type("Selected text for formatting");
        await page.keyboard.press("ControlOrMeta+a");
        const toolbar = page.getByRole("toolbar", { name: "Formatting toolbar" });
        await expect(toolbar).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(toolbar).toBeHidden();
        await expect(page.locator("html")).not.toHaveAttribute("data-window-close-count");
        expect(await page.evaluate(() => window.getSelection()?.toString())).toContain("Selected text for formatting");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Shift+ArrowLeft");
        await expect(toolbar).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(toolbar).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(page.locator("html")).toHaveAttribute("data-window-close-count", "1");
    });

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

for (const route of ["floating-editor", "quicknote", "mathnote"]) {
    for (const modifier of ["Control", "Meta"]) {
        test(`${route}: ${modifier}+Escape closes the window through a modal`, async ({ page }) => {
            await page.goto(`/${route}`);
            await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
            await page.keyboard.press("Control+f");
            await expect(page.getByRole("textbox", { name: "Find text", exact: true })).toBeVisible();
            await page.getByRole("main").getByRole("button", { name: "New note", exact: true }).first().click();
            await expect(page.getByRole("dialog", { name: /Create new note/i })).toBeVisible();
            await page.keyboard.press(`${modifier}+Escape`);
            await expect(page.locator("html")).toHaveAttribute("data-window-close-count", "1");
        });
    }
}
