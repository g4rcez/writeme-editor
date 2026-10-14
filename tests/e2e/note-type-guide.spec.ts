import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function finishAnimations(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
            document
                .getAnimations()
                .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
                .map((animation) => animation.finished.catch(() => undefined)),
        );
    });
}

test("offers concrete examples before opening the selected creation form", async ({ cleanPage: page }, testInfo) => {
    await goHome(page);
    await page.getByRole("button", { name: "Explore note types" }).click();
    const guide = page.getByRole("dialog", { name: "Explore note types" });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole("radio", { name: "Markdown", exact: true })).toBeChecked();
    await expect(guide.getByText("Example: A project brief with headings, links, and a checklist.")).toBeVisible();
    await guide.getByRole("radio", { name: "Task board", exact: true }).check();
    await expect(guide.getByRole("radio", { name: "Task board", exact: true })).toBeChecked();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Start with one small thought.")).toBeVisible();
    for (const theme of ["light", "dark"]) {
        await page.evaluate((colorScheme) => {
            document.documentElement.classList.toggle("dark", colorScheme === "dark");
            document.documentElement.classList.toggle("light", colorScheme === "light");
        }, theme);
        await finishAnimations(page);
        const path = testInfo.outputPath(`note-type-guide-${theme}.png`);
        await page.screenshot({ path });
        await testInfo.attach(`Desktop ${theme}`, { path, contentType: "image/png" });
    }
    await guide.getByRole("button", { name: "Continue", exact: true }).click();
    const creation = page.getByRole("dialog", { name: "Create task note" });
    await expect(guide).toBeHidden();
    await expect(creation).toBeVisible();
    await expect(creation.getByTitle("Note title")).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press("Escape");
    await expect(creation).toBeHidden();
    await page.getByRole("button", { name: "Explore note types" }).click();
    await guide.getByRole("radio", { name: "Task board", exact: true }).check();
    await guide.getByRole("button", { name: "Continue", exact: true }).click();
    await creation.getByTitle("Note title").fill("Launch checklist");
    await creation.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    await expect(page.getByRole("main").getByRole("heading", { name: "Launch checklist", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Task board", exact: true })).toBeVisible();
});

for (const [format, title] of [
    ["Markdown", "Create new note"],
    ["Today's quick note", "Today's quick note"],
    ["Task board", "Create task note"],
    ["Handwriting", "Create handwritten note"],
    ["Excalidraw", "Create Excalidraw note"],
    ["PDF", "Import PDF"],
]) {
    test(`opens the existing ${format} form without creating a note`, async ({ cleanPage: page }) => {
        await goHome(page);
        await page.getByRole("button", { name: "Explore note types" }).click();
        const guide = page.getByRole("dialog", { name: "Explore note types" });
        await guide.getByRole("radio", { name: format, exact: true }).check();
        await guide.getByRole("button", { name: "Continue", exact: true }).click();
        const creation = page.getByRole("dialog", { name: title, exact: true });
        await expect(creation).toBeVisible();
        await expect(guide).toBeHidden();
        await expect(page).toHaveURL(/\/$/);
        if (format === "PDF") {
            await expect(creation.getByLabel("PDF document", { exact: true })).toBeVisible();
            await expect(creation.getByRole("button", { name: /^Import/ })).toBeDisabled();
            await expect(creation).toBeVisible();
        }
        await page.keyboard.press("Escape");
        await expect(creation).toBeHidden();
        await expect(page.getByText("Start with one small thought.")).toBeVisible();
    });
}

test("supports keyboard selection, cancellation, and the direct New note shortcut", async ({ cleanPage: page }) => {
    await goHome(page);
    const trigger = page.getByRole("button", { name: "Explore note types" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const guide = page.getByRole("dialog", { name: "Explore note types" });
    await expect(guide.getByRole("radio", { name: "Markdown", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(guide.getByRole("radio", { name: "Today's quick note", exact: true })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(guide.getByRole("radio", { name: "Markdown", exact: true })).toBeChecked();
    await guide.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(guide).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("ControlOrMeta+n");
    await expect(page.getByRole("dialog", { name: "Create new note" })).toBeVisible();
    await expect(guide).toBeHidden();
});

test("keeps examples and actions usable on narrow screens and both themes", async ({ cleanPage: page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goHome(page);
    await page.getByRole("button", { name: "Explore note types" }).click();
    const guide = page.getByRole("dialog", { name: "Explore note types" });
    await guide.getByRole("radio", { name: "PDF", exact: true }).check();
    await guide.getByRole("radio", { name: "PDF", exact: true }).locator("..").scrollIntoViewIfNeeded();
    await expect(guide.getByRole("button", { name: "Continue", exact: true })).toBeInViewport();
    await expect(guide.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    for (const action of ["Continue", "Cancel"]) {
        const bounds = await guide.getByRole("button", { name: action, exact: true }).boundingBox();
        if (!bounds) throw new Error(`${action} has no visible bounds.`);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    for (const theme of ["light", "dark"]) {
        await page.evaluate((colorScheme) => {
            document.documentElement.classList.toggle("dark", colorScheme === "dark");
            document.documentElement.classList.toggle("light", colorScheme === "light");
        }, theme);
        await finishAnimations(page);
        const path = testInfo.outputPath(`note-type-guide-mobile-${theme}.png`);
        await page.screenshot({ path });
        await testInfo.attach(`Mobile ${theme}`, { path, contentType: "image/png" });
    }
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(guide.getByRole("button", { name: "Continue", exact: true })).toBeInViewport();
    await expect(guide.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
});

test("gates meeting notes by immutable build capability", async ({ cleanPage: page }) => {
    await goHome(page);
    await page.getByRole("button", { name: "Explore note types" }).click();
    const guide = page.getByRole("dialog", { name: "Explore note types" });
    const meeting = guide.getByRole("radio", { name: "Meeting notes", exact: true });
    if (process.env.WRITEME_DISABLE_FEATURES?.split(",").includes("meetingNotes")) {
        await expect(meeting).toHaveCount(0);
        await expect(guide.getByRole("radio")).toHaveCount(6);
    } else {
        await expect(meeting).toHaveCount(1);
        await meeting.check();
        await guide.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Create meeting note" })).toBeVisible();
        await expect(page).toHaveURL(/\/$/);
    }
});

test("omits meeting notes on a native mobile platform", async ({ cleanPage: page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, "CapacitorCustomPlatform", { value: { name: "ios" } });
    });
    await goHome(page);
    await page.getByRole("button", { name: "Explore note types" }).click();
    const guide = page.getByRole("dialog", { name: "Explore note types" });
    await expect(guide.getByRole("radio", { name: "Meeting notes", exact: true })).toHaveCount(0);
    await expect(guide.getByRole("radio")).toHaveCount(6);
});
