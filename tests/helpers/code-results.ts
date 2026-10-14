import { expect, type Page } from "@playwright/test";

export async function setCodeMarkdown(page: Page, markdown: string): Promise<void> {
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.fill(markdown);
    await expect(raw).toHaveText(markdown, { useInnerText: true });
    await raw.press("Control+s");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.locator(".node-codeBlock").first()).toBeVisible();
}

export async function waitForCodeSave(page: Page): Promise<void> {
    await page.getByRole("textbox", { name: "Note editor", exact: true }).press("Control+s");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
}
