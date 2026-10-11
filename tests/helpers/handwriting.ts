import { expect, type Page } from "@playwright/test";

export async function writeNotebook(page: Page): Promise<void> {
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
    const collapse = page.getByRole("button", { name: "Collapse sidebar", exact: true });
    if (await collapse.isVisible()) await collapse.click();
    else {
        const closeMenu = page.getByRole("button", { name: "Close workspace menu", exact: true });
        if (await closeMenu.isVisible()) await closeMenu.click();
    }
    await page.getByRole("button", { name: "Handwritten note", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create handwritten note" });
    await dialog.getByTitle("Note title").fill("Release notebook");
    if (await dialog.getByTitle("Note title").getAttribute("aria-expanded") === "true")
        await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    await expect(canvas).toBeVisible();
    await page.getByRole("button", { name: "Notebook options", exact: true }).click();
    const color = page.getByRole("textbox", { name: "Paper color hex" });
    await color.fill("#171717");
    await color.press("Tab");
    await page.getByRole("combobox", { name: "Paper style" }).selectOption("grid");
    await page.getByRole("combobox", { name: "Pattern spacing" }).selectOption("48");
    await page.getByRole("button", { name: "Close options", exact: true }).click();
    await page.getByRole("button", { name: "Ink options", exact: true }).click();
    await page.getByRole("button", { name: "White ink", exact: true }).click();
    await addInk(page);
    await expect(canvas.locator("[data-ink-stroke]")).toHaveAttribute("fill", "#ffffff");
    await page.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(0);
    await page.getByRole("button", { name: "Redo drawing", exact: true }).click();
    await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
}

export async function addInk(page: Page, y = 220): Promise<void> {
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    await expect
        .poll(() =>
            canvas.evaluate((element, offset) => {
                const bounds = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(bounds.x + 80, bounds.y + offset));
            }, y),
        )
        .toBe(true);
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Canvas is not visible");
    await page.mouse.move(bounds.x + 80, bounds.y + y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 180, bounds.y + y, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
}

export async function navigateHome(page: Page): Promise<void> {
    const home = page.getByRole("button", { name: "Go to home", exact: true });
    if (await home.isVisible()) await home.click();
    else {
        await page.getByRole("button", { name: "Open workspace menu", exact: true }).click();
        await page.getByRole("button", { name: "Local workspace Your notes", exact: true }).click();
    }
}

export async function expectSavedNotebook(page: Page, strokes = 1): Promise<void> {
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(strokes);
    await expect(canvas).toHaveCSS("background-color", "rgb(23, 23, 23)");
    await expect(canvas.locator(":scope > defs > pattern")).toHaveAttribute("width", "48");
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
}
