import type { Page } from "@playwright/test";
import { expectCanvasZoomShortcuts } from "../helpers/canvas-zoom";
import { createNote, expect, test } from "./fixtures";

async function openHome(page: Page): Promise<void> {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible({
        timeout: 15_000,
    });
}

for (const modifier of ["Control", "Meta"] as const) {
    test(`${modifier} plus/minus does not resize the note editor interface`, async ({ page }) => {
        await openHome(page);
        await createNote(page, "Zoom shortcut note");
        await page.locator(".ProseMirror").first().click();
        const size = await page
            .locator("html")
            .evaluate((element) => getComputedStyle(element).getPropertyValue("--default-size"));
        await page.keyboard.press(`${modifier}+=`);
        await expect
            .poll(() =>
                page
                    .locator("html")
                    .evaluate((element) => getComputedStyle(element).getPropertyValue("--default-size")),
            )
            .toBe(size);
        await page.keyboard.press(`${modifier}+-`);
        await expect
            .poll(() =>
                page
                    .locator("html")
                    .evaluate((element) => getComputedStyle(element).getPropertyValue("--default-size")),
            )
            .toBe(size);
        await page.keyboard.press(`${modifier}+0`);
        await expect
            .poll(() =>
                page
                    .locator("html")
                    .evaluate((element) => getComputedStyle(element).getPropertyValue("--default-size")),
            )
            .toBe(size);
    });
}

test("plus/minus zooms only the Excalidraw canvas", async ({ page }) => {
    await openHome(page);
    await page.keyboard.press("ControlOrMeta+Shift+P");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByPlaceholder("Search for...").fill("New excalidraw");
    await palette.getByText("New excalidraw", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create Excalidraw note" });
    await dialog.getByTitle("Note title").fill("Zoom drawing");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/?#]+/);
    const canvas = page.locator(".excalidraw .excalidraw__canvas.interactive");
    await expect(canvas).toBeVisible();
    await canvas.click();
    const zoom = page.locator(".excalidraw .reset-zoom-button");
    await expectCanvasZoomShortcuts(page, zoom, "ControlOrMeta", "110%");
});
