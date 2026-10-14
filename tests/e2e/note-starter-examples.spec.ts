import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

test.use({ launchOptions: { slowMo: process.env.WRITEME_CAPTURE_EVIDENCE === "1" ? 180 : 0 } });

async function settleForCapture(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await Promise.allSettled(
            document
                .getAnimations()
                .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
                .map((animation) => animation.finished),
        );
    });
}

async function openNoteDialog(page: Page): Promise<void> {
    await goHome(page);
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
}

test("offers a starter before the first saved template and persists its content", async ({ cleanPage: page }, info) => {
    await openNoteDialog(page);
    const dialog = page.getByRole("dialog", { name: "Create new note" });
    await dialog.getByTitle("Note title").fill("Launch plan");
    const starter = dialog.getByRole("combobox", { name: "Starter example (optional)" });
    await expect(starter).toBeVisible();
    await starter.fill("Project brief");
    await page.getByRole("option", { name: "Project brief", exact: true }).click();
    await expect(dialog).toContainText("Define the goal, scope, and next steps for a project.");
    await dialog.getByText("Preview content", { exact: true }).click();
    await expect(dialog.getByRole("region", { name: "Starter content preview" })).toContainText("## Goal");
    await expect(dialog.getByTitle("Note title")).toHaveValue("Launch plan");
    const screenshot = info.outputPath("starter-preview-desktop.png");
    await settleForCapture(page);
    await page.screenshot({ path: screenshot });
    await info.attach("Starter preview", { path: screenshot, contentType: "image/png" });
    await dialog.getByRole("button", { name: "Create note", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    const editor = page.locator(".ProseMirror").first();
    await expect(editor).toContainText("Goal");
    await expect(page.locator("[data-tab-id]").filter({ hasText: "Launch plan" })).toBeVisible();
    await page.reload();
    await expect(editor).toContainText("Next steps");
    await expect(editor).toContainText("Define the problem");
    const video = page.video();
    await page.context().close();
    if (video) await info.attach("Starter walkthrough", { path: await video.path(), contentType: "video/webm" });
});

test("resets cancelled choices and creates a blank note", async ({ cleanPage: page }) => {
    await openNoteDialog(page);
    const dialog = page.getByRole("dialog", { name: "Create new note" });
    const starter = dialog.getByRole("combobox", { name: "Starter example (optional)" });
    await starter.fill("Weekly review");
    await page.getByRole("option", { name: "Weekly review", exact: true }).click();
    await expect(dialog).toContainText("Reflect on the week and choose what matters next.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    await expect(starter).toHaveValue("Blank note");
    await expect(dialog.getByText("Preview content", { exact: true })).toHaveCount(0);
    const title = dialog.getByTitle("Note title");
    await title.fill("Blank draft");
    await title.press("Tab");
    await expect(starter).toBeFocused();
    await expect(page.getByRole("option", { name: "Project brief", exact: true })).toBeVisible();
    await starter.press("Escape");
    await expect(page.getByRole("option", { name: "Project brief", exact: true })).toBeHidden();
    await expect(starter).toHaveValue("Blank note");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Create note", exact: true }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    await expect(page.locator(".ProseMirror").first()).toHaveText("");
});

test("keeps saved templates available and mutually exclusive with starters", async ({ cleanPage: page }) => {
    await goHome(page);
    await page.goto("/settings/templates");
    await page.getByRole("button", { name: "New Template" }).click();
    const templateDialog = page.getByRole("dialog", { name: "Create new template" });
    await templateDialog.getByTitle("Template Name").fill("Team agenda");
    await templateDialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/templates\/[^/]+$/);
    await openNoteDialog(page);
    const dialog = page.getByRole("dialog", { name: "Create new note" });
    const starter = dialog.getByRole("combobox", { name: "Starter example (optional)" });
    const template = dialog.getByRole("combobox", { name: "Template (optional)" });
    await starter.fill("Reading notes");
    await page.getByRole("option", { name: "Reading notes", exact: true }).click();
    await template.fill("Team agenda");
    await page.getByRole("option", { name: "Team agenda", exact: true }).click();
    await expect(starter).toHaveValue("Blank note");
    await expect(dialog.getByText("Preview content", { exact: true })).toHaveCount(0);
    await starter.fill("Reading notes");
    await page.getByRole("option", { name: "Reading notes", exact: true }).click();
    await expect(template).toHaveValue("Blank note");
    await template.fill("Team agenda");
    await page.getByRole("option", { name: "Team agenda", exact: true }).click();
    await dialog.getByTitle("content").fill("Discuss next steps");
    await dialog.getByTitle("Note title").fill("Planning meeting");
    await dialog.getByRole("button", { name: "Create note", exact: true }).click();
    await expect(page.locator(".ProseMirror").first()).toContainText("Discuss next steps");
    await expect(page.locator(".ProseMirror").first()).not.toContainText("Key ideas");
});

for (const theme of ["light", "dark"] as const) {
    test(`supports keyboard selection and a bounded preview on narrow screens (${theme})`, async ({
        cleanPage: page,
    }, info) => {
        await page.setViewportSize({ width: theme === "light" ? 375 : 768, height: 812 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await goHome(page);
        await page.goto("/settings/appearance");
        await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption(theme);
        await page.getByRole("button", { name: "Save Appearance", exact: true }).click();
        await openNoteDialog(page);
        const dialog = page.getByRole("dialog", { name: "Create new note" });
        await dialog.getByTitle("Note title").fill("Try Markdown");
        const starter = dialog.getByRole("combobox", { name: "Starter example (optional)" });
        await starter.fill("Markdown playground");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(dialog).toContainText("Try headings, tasks, code, and tables in the editor.");
        const disclosure = dialog.getByText("Preview content", { exact: true });
        await disclosure.focus();
        await page.keyboard.press("Enter");
        await expect(dialog.getByRole("region", { name: "Starter content preview" })).toContainText("```typescript");
        const bounds = await dialog.boundingBox();
        if (!bounds) throw new Error("Starter dialog has no bounds");
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(theme === "light" ? 376 : 769);
        await expect(dialog.getByRole("button", { name: "Create note", exact: true })).toBeInViewport();
        const screenshot = info.outputPath(`starter-preview-${theme}.png`);
        await settleForCapture(page);
        await page.screenshot({ path: screenshot });
        await info.attach(`Starter preview ${theme}`, { path: screenshot, contentType: "image/png" });
        for (const viewport of [
            { width: 375, height: 812 },
            { width: 1440, height: 900 },
        ]) {
            await page.setViewportSize(viewport);
            await expect(dialog.getByRole("button", { name: "Create note", exact: true })).toBeInViewport();
            await settleForCapture(page);
            const imagePath = info.outputPath(`starter-preview-${theme}-${viewport.width}.png`);
            await page.screenshot({ path: imagePath });
            await info.attach(`Starter preview ${theme} ${viewport.width}px`, {
                path: imagePath,
                contentType: "image/png",
            });
        }
        await dialog.getByRole("button", { name: "Create note", exact: true }).click();
        await expect(page.locator(".ProseMirror").first()).toContainText("Try Markdown");
        await expect(page.locator(".ProseMirror").first().locator("table")).toBeVisible();
    });
}
