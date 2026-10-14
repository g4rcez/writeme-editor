import type { Page } from "@playwright/test";
import { createNote, expect, goHome, test } from "./fixtures";

const markdown =
    "# Parent\n\nParent body\n\n## Child\n\nHidden needle\n\n- [ ] Nested task\n\n### Grandchild\n\nDeep body\n\n# Next\n\nVisible body";

async function setup(page: Page, title = "Folding test", initial = true): Promise<string> {
    if (initial) await goHome(page);
    const url = await createNote(page, title);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.fill(markdown);
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Unsaved changes");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", { timeout: 15_000 });
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.getByRole("button", { name: "Collapse Parent", exact: true })).toBeVisible();
    await expect(page.locator(".ProseMirror h1").first()).toHaveAttribute("data-id", /\S+/);
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", { timeout: 15_000 });
    return url;
}

test("keeps nested folds across reload while preserving raw and print content", async ({
    cleanPage: page,
}, testInfo) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await expect(editor.locator("h2")).toBeHidden();
    await expect(editor.getByText("Visible body", { exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand Parent", exact: true })).toHaveAttribute(
        "aria-expanded",
        "false",
    );
    await page.getByRole("button", { name: "Expand Parent", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await expect(raw).toContainText("Hidden needle");
    await expect(raw).toContainText("Deep body");
    await expect(raw).toContainText("- [ ] Nested task");
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("nested-folds.png") });
});

test("keeps folding state isolated when opening and returning to another note", async ({ cleanPage: page }) => {
    const url = await setup(page);
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    await setup(page, "Independent folding note", false);
    await expect(page.getByRole("button", { name: "Collapse Child", exact: true })).toBeVisible();
    await page.goto(url);
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
});

test("reveals hidden matches and outline targets and keeps task controls usable", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+f");
    await page.getByRole("textbox", { name: "Find text", exact: true }).fill("Hidden needle");
    await expect(editor.locator(".search-result-current")).toHaveText("Hidden needle");
    await expect(editor.locator(".search-result-current")).toBeVisible();
    await page.keyboard.press("Escape");
    const task = editor.locator('input[type="checkbox"]').first();
    await task.check();
    await expect(task).toBeChecked();
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await page.getByRole("button", { name: "Open table of contents", exact: true }).click();
    await page
        .getByRole("dialog", { name: "Table of contents", exact: true })
        .getByRole("button", { name: "Grandchild", exact: true })
        .click();
    await expect(editor.locator("h3")).toBeVisible();
    await expect(editor.getByText("Deep body", { exact: true })).toBeVisible();
    await expect(task).toBeChecked();
    await page.getByRole("button", { name: "Open note context", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Context", exact: true });
    await panel.getByRole("button", { name: "Collapse all", exact: true }).click();
    await expect(editor.locator("h2")).toBeHidden();
    await panel.getByRole("button", { name: "Child", exact: true }).click();
    await expect(editor.locator("h2")).toBeVisible();
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await expect(editor.getByText("Visible body", { exact: true })).toBeHidden();
    await panel.getByRole("button", { name: "Expand all", exact: true }).click();
    await expect(editor.getByText("Visible body", { exact: true })).toBeVisible();
});

test("supports keyboard disclosure, Vim, heading edits, and undo", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const control = page.getByRole("button", { name: "Collapse Parent", exact: true });
    await control.focus();
    await page.keyboard.press("Enter");
    const expandedControl = page.getByRole("button", { name: "Expand Parent", exact: true });
    await expect(expandedControl).toBeFocused();
    await expect(editor.locator("h2")).toBeHidden();
    await page.keyboard.press("Space");
    await expect(control).toBeFocused();
    await expect(editor.locator("h2")).toBeVisible();
    await editor.locator("h1").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
    await expect(expandedControl).toBeVisible();
    await page.keyboard.type("Revised ");
    await expect(editor.locator("h2")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor.locator("h1").first()).toHaveText("Parent");
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
    await expect(editor.locator("h2")).toBeHidden();
    await page.keyboard.press("ControlOrMeta+Alt+0");
    await expect(editor.locator("h1")).toHaveCount(1);
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor.locator("h1").first()).toHaveText("Parent");
    await page.getByRole("checkbox", { name: "Vim mode", exact: true }).check();
    await editor.locator("h1").first().click();
    await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
    await expect(expandedControl).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+BracketRight");
    await expect(control).toBeVisible();
    await page.keyboard.type("j");
    await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
});

test("keeps sentence comments usable after folding and revealing their section", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.focus();
    await editor.evaluate((element) => {
        const paragraph = Array.from(element.querySelectorAll("p")).find(
            (node) => node.textContent === "Hidden needle",
        );
        if (!paragraph) throw new Error("Comment text is missing");
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
    });
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments", exact: true });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep this detail");
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel).toContainText("Keep this detail");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await expect(editor.getByRole("link", { name: "Hidden needle", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Expand Parent", exact: true }).click();
    await editor.getByRole("link", { name: "Hidden needle", exact: true }).click();
    await expect(panel).toContainText("Keep this detail");
});

test.describe("touch disclosure", () => {
    test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
    test("has reachable disclosure controls on narrow screens", async ({ cleanPage: page }, testInfo) => {
        await setup(page);
        const control = page.getByRole("button", { name: "Collapse Parent", exact: true });
        const bounds = await control.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        await control.tap();
        await expect(page.getByRole("button", { name: "Expand Parent", exact: true })).toBeVisible();
        await expect(page.locator(".ProseMirror h2")).toBeHidden();
        await page.getByRole("button", { name: "Expand Parent", exact: true }).tap();
        await expect(page.locator(".ProseMirror h2")).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath("touch-disclosures.png") });
    });
});
