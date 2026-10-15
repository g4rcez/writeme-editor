import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function createFilteredBoard(page: Page): Promise<void> {
    await goHome(page);
    const close = page.getByRole("button", { name: "Close workspace menu", exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByRole("button", { name: "Task board", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create task note" });
    await dialog.getByTitle("Note title").fill("Release checklist");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    await expect(page.getByRole("region", { name: "Task board", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add task to Backlog", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Review release notes");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
}

test("explains search misses and restores tasks with a keyboard action", async ({ cleanPage: page }, info) => {
    await createFilteredBoard(page);
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("missing task");
    await expect(page.locator(".wm-task-card")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Backlog column" })).toContainText("No matching tasks");
    await expect(page.getByRole("status").filter({ hasText: "No tasks match these filters." })).toBeVisible();
    const screenshot = info.outputPath("task-search-recovery.png");
    await page.screenshot({ path: screenshot });
    await info.attach("Search recovery", { path: screenshot, contentType: "image/png" });
    const reset = page.getByRole("button", { name: "Clear filters", exact: true });
    await reset.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("searchbox", { name: "Search tasks" })).toHaveValue("");
    await expect(page.getByRole("searchbox", { name: "Search tasks" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Edit Review release notes", exact: true })).toBeVisible();
    await expect(reset).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Edit Review release notes", exact: true })).toBeVisible();
});

test("resets combined filters even when all columns are hidden", async ({ cleanPage: page }) => {
    await createFilteredBoard(page);
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("missing task");
    await page.getByRole("checkbox", { name: "Hide empty columns", exact: true }).check();
    await expect(page.locator(".wm-task-column")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(page.getByRole("button", { name: "All tasks", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("checkbox", { name: "Hide empty columns", exact: true })).not.toBeChecked();
    await expect(page.locator(".wm-task-column")).toHaveCount(4);
    await expect(page.locator(".wm-task-card")).toHaveCount(1);
});

test("keeps recovery controls within a narrow viewport", async ({ cleanPage: page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createFilteredBoard(page);
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("missing task");
    const reset = page.getByRole("button", { name: "Clear filters", exact: true });
    await expect(reset).toBeVisible();
    const bounds = await reset.boundingBox();
    if (!bounds) throw new Error("Clear filters has no visible bounds");
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const screenshot = info.outputPath("task-search-recovery-mobile.png");
    await page.screenshot({ path: screenshot });
    await info.attach("Mobile search recovery", { path: screenshot, contentType: "image/png" });
    await reset.click();
    await expect(page.locator(".wm-task-card")).toHaveCount(1);
});

test("distinguishes genuinely empty columns from filtered columns", async ({ cleanPage: page }) => {
    await createFilteredBoard(page);
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("missing task");
    await expect(page.getByRole("region", { name: "Backlog column" })).toContainText("No matching tasks");
    await expect(
        page.getByRole("region", { name: "Todo column" }).getByRole("button", { name: "Add a task", exact: true }),
    ).toBeVisible();
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("Review");
    await expect(page.locator(".wm-task-card")).toHaveCount(1);
    await expect(page.getByText("No tasks match these filters.", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await page.getByRole("button", { name: "Edit Review release notes", exact: true }).click();
    await page.getByRole("button", { name: "Delete task", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    await expect(page.getByText("No matching tasks", { exact: true })).toHaveCount(0);
});

test("captures filter recovery in both themes at desktop and phone widths", async ({ cleanPage: page }, info) => {
    await createFilteredBoard(page);
    const noteUrl = page.url();
    for (const theme of ["light", "dark"]) {
        await page.goto("/settings/appearance");
        await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
        await page.getByRole("button", { name: "Save Appearance", exact: true }).click();
        await page.goto(noteUrl);
        await page.getByRole("searchbox", { name: "Search tasks" }).fill("missing task");
        await expect(page.getByText("No tasks match these filters.", { exact: true })).toBeVisible();
        for (const viewport of [
            { width: 1440, height: 900 },
            { width: 390, height: 844 },
        ]) {
            await page.setViewportSize(viewport);
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate(async () => {
                await new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                );
                await Promise.allSettled(
                    document
                        .getAnimations()
                        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
                        .map((animation) => animation.finished),
                );
            });
            const screenshot = info.outputPath(`task-filter-${theme}-${viewport.width}.png`);
            await page.screenshot({ path: screenshot });
            await info.attach(`${theme} ${viewport.width}`, { path: screenshot, contentType: "image/png" });
        }
        await page.getByRole("button", { name: "Clear filters", exact: true }).click();
        await expect(page.getByRole("button", { name: "Edit Review release notes", exact: true })).toBeVisible();
        await page.setViewportSize({ width: 1440, height: 900 });
    }
});

test("walks through task search recovery", async ({ cleanPage: page }, info) => {
    await createFilteredBoard(page);
    await expect(page.locator(".wm-task-column")).toHaveCount(4);
    await page.waitForTimeout(1200);
    await page.getByRole("searchbox", { name: "Search tasks" }).pressSequentially("missing task", { delay: 100 });
    await expect(page.getByText("No tasks match these filters.", { exact: true })).toBeVisible();
    await page.waitForTimeout(1600);
    await page.getByRole("checkbox", { name: "Hide empty columns", exact: true }).check();
    await expect(page.locator(".wm-task-column")).toHaveCount(0);
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit Review release notes", exact: true })).toBeVisible();
    await page.waitForTimeout(1600);
    const screenshot = info.outputPath("task-filter-restored.png");
    await page.screenshot({ path: screenshot });
    await info.attach("Restored board", { path: screenshot, contentType: "image/png" });
});
