import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function setup(page: Page, text = "one two three"): Promise<void> {
    await goHome(page);
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill("Neovim test");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await editor.click();
    await page.keyboard.type(text);
    const saveStatus = page.getByRole("status", { name: "Note save status" });
    await expect(saveStatus).toHaveText("Unsaved changes");
    await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
    await page.getByRole("checkbox", { name: "Vim mode", exact: true }).check();
    await editor.click();
    await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
    await page.keyboard.type("gg0");
}

test("changes words, repeats, undoes, and persists a formatted note", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const footer = page.locator(".writeme-editor-status-bar");
    const saveStatus = footer.getByRole("status", { name: "Note save status" });
    const vimStatus = footer.getByRole("status", { name: "Vim mode" });
    await expect(vimStatus).toContainText("NORMAL");
    await expect(saveStatus).toBeVisible();
    await expect(vimStatus).toBeVisible();
    await page.keyboard.type("ciwNEW");
    await expect(vimStatus).toContainText("INSERT");
    await page.keyboard.press("Escape");
    await page.keyboard.type("w.");
    await expect(editor).toHaveText("NEW NEW three");
    await page.keyboard.type("u");
    await expect(editor).toHaveText("NEW two three");
    await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
    await page.reload();
    await expect(editor).toHaveText("NEW two three");
    await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
});

test("selects characters in both directions and blocks normal-mode typing", async ({ cleanPage: page }) => {
    await setup(page, "abcdef");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await page.keyboard.type("3lvhh");
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("bcd");
    await page.keyboard.type("d");
    await expect(editor).toHaveText("aef");
    await page.keyboard.type("Q");
    await expect(editor).toHaveText("aef");
    await page.keyboard.press("Backspace");
    await expect(editor).toHaveText("aef");
    await page.keyboard.type(".");
    await expect(editor).toHaveText("");
});

test("prioritizes Vim Ctrl-W and leaves Cmd shortcuts available to the app", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const route = page.url();

    await page.keyboard.press("Control+w");
    await expect(editor).toHaveText("two three");
    await expect(page).toHaveURL(route);

    await page.keyboard.type("A word");
    await expect(page.getByRole("status", { name: "Vim mode" })).toContainText("INSERT");
    await page.keyboard.press("Control+w");
    await expect(editor).toHaveText("two three");
    await expect(page).toHaveURL(route);

    await page.getByRole("toolbar", { name: "Note tools" }).getByRole("button", { name: "Markdown" }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.click();
    await page.keyboard.press("Control+w");
    await expect(raw).toContainText("three");
    await expect(page).toHaveURL(route);

    await page.keyboard.press("Meta+w");
    await expect(page).toHaveURL("/");
    await expect(page.locator("[data-tab-id]").filter({ hasText: "Neovim test" })).toHaveCount(0);
});

test("keeps Cmd+S available to the app while Vim is in Normal mode", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const saveStatus = page.getByRole("status", { name: "Note save status" });
    await page.keyboard.type("i!");
    await page.keyboard.press("Escape");
    await expect(saveStatus).toHaveText("Unsaved changes");
    await page.keyboard.press("Meta+s");
    await expect(saveStatus).toHaveText("Saved", { timeout: 2000 });
    await page.reload();
    await expect(editor).toContainText("!one two three");
});

test("restores normal editing when disabled and keeps Markdown Vim available", async ({ cleanPage: page }) => {
    await setup(page);
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    const toggle = toolbar.getByRole("checkbox", { name: "Vim mode", exact: true });
    await toggle.uncheck();
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("!");
    await expect(editor).toHaveText("one two three!");
    await toggle.check();
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.click();
    await page.keyboard.type("gg0dw");
    await expect(raw).toContainText("two three!");
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(editor).toHaveText("two three!");
});

test("finds text and leaves completion working in Insert mode", async ({ cleanPage: page }) => {
    await setup(page, "one two three");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await page.keyboard.type("/two");
    await expect(page.getByRole("status", { name: "Vim mode" })).toContainText("/two");
    await page.keyboard.press("Enter");
    await page.keyboard.type("ciwfour");
    await page.keyboard.press("Escape");
    await expect(editor).toHaveText("one four three");
    await page.keyboard.type("A one");
    await page.keyboard.press("Control+Space");
    const suggestions = page.getByRole("listbox", { name: "Word suggestions" });
    await expect(suggestions).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
    await expect(suggestions).toBeHidden();
});

test("moves across wrapped screen lines and shows a visible cursor", async ({ cleanPage: page }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    await setup(page, "one two three four five six seven eight nine ten ".repeat(8));
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const cursor = editor.locator(".neovim-cursor");
    const before = await cursor.boundingBox();
    await page.keyboard.type("gj");
    await expect.poll(async () => (await cursor.boundingBox())?.y ?? 0).toBeGreaterThan(before?.y ?? 0);
    await page.screenshot({ path: "test-results/neovim-wrapped-cursor.png" });
});
