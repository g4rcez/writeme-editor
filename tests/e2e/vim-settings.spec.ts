import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function note(page: Page): Promise<string> {
    await goHome(page);
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill("Global Vim configuration");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await editor.click();
    await page.keyboard.type("one two three");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    return page.url();
}

const init = `const key: string = "Q";
vim.opt.leader = ",";
vim.keymap.set("normal", key, "dw");
vim.keymap.set("insert", "jk", "<Esc>");`;

test("saves one init.ts and applies its keybinds to both editors after reload", async ({ cleanPage: page }) => {
    const url = await note(page);
    await page.goto("/settings/vim");
    await expect(page.getByRole("heading", { name: "Vim", exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "Enable Vim mode in all editors" }).check();
    await page.getByRole("textbox", { name: "Global init.ts" }).fill(init);
    await page.getByRole("button", { name: "Save Vim", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Vim settings saved for all editors.");
    await page.goto(url);
    const formatted = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(formatted).toHaveAttribute("data-neovim-mode", "normal");
    await expect(formatted).toHaveAttribute("aria-busy", "false");
    await formatted.click();
    await page.keyboard.type("gg0Q");
    await expect(formatted).toHaveText("two three");
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.click();
    await page.keyboard.type("gg0Q");
    await expect(raw).toHaveText("three");
    await page.keyboard.type("iNEWjk");
    await page.keyboard.type("Q");
    await expect(raw).not.toContainText("jk");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await page.reload();
    await expect(raw).toBeVisible();
    await expect(toolbar.getByRole("checkbox", { name: "Vim mode" })).toBeChecked();
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(formatted).toHaveAttribute("aria-busy", "false");
    await formatted.click();
    await page.keyboard.type("iXjk");
    await expect(formatted).toHaveAttribute("data-neovim-mode", "normal");
    await expect(formatted).not.toContainText("jk");
});

test("keeps the saved configuration after syntax errors and times out an endless script", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    await page.goto("/settings/vim");
    const source = page.getByRole("textbox", { name: "Global init.ts" });
    await source.fill(init);
    await page.getByRole("button", { name: "Save Vim", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    await source.fill("const broken: =");
    await page.getByRole("button", { name: "Save Vim", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.reload();
    await expect(source).toHaveValue(init);
    await source.fill("while (true) {}");
    await page.getByRole("button", { name: "Validate", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("too long", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Save Vim", exact: true })).toBeEnabled();
});

test("resets custom bindings with an empty init.ts and keeps controls within a narrow viewport", async ({
    cleanPage: page,
}) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const url = await note(page);
    await page.goto("/settings/vim");
    await page.getByRole("checkbox", { name: "Enable Vim mode in all editors" }).check();
    const source = page.getByRole("textbox", { name: "Global init.ts" });
    await source.fill(init);
    await page.getByRole("button", { name: "Save Vim", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    await source.fill("");
    await page.getByRole("button", { name: "Save Vim", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    const bounds = await source.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(375);
    await page.screenshot({ path: "test-results/vim-settings-narrow.png" });
    await page.goto(url);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
    await editor.click();
    await page.keyboard.type("gg0Q");
    await expect(editor).toHaveText("one two three");
});
