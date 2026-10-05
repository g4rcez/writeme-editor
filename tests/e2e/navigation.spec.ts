import { expect, goHome, test } from "./fixtures";

test.describe("Navigation", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("All notes link goes to notes list", async ({ cleanPage: page }) => {
        await page.getByRole("link", { name: "All notes" }).click();
        await expect(page).toHaveURL(/\/notes$/);
        await expect(page.getByRole("heading", { name: "All Notes" })).toBeVisible();
    });

    test("direct URLs render core pages", async ({ cleanPage: page }) => {
        await page.goto("/settings");
        await expect(page.getByRole("heading", { name: "Quick Settings" })).toBeVisible();

        await page.goto("/tags");
        await expect(page).toHaveURL(/\/tags$/);

        await page.goto("/read-it-later");
        await expect(page).toHaveURL(/\/read-it-later$/);
    });

    test("create-note dialog closes on Escape", async ({ cleanPage: page }) => {
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await expect(dialog).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
    });

    test("global ⌘N opens the create note dialog from any page", async ({ cleanPage: page }) => {
        await page.goto("/settings");
        await expect(page.getByRole("heading", { name: "Quick Settings" })).toBeVisible();

        await page.keyboard.press("ControlOrMeta+n");
        await expect(page.getByRole("dialog", { name: /Create new note/i })).toBeVisible();
    });
    test("constrains sidebar resizing to the available desktop width", async ({ cleanPage: page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width: 1000, height: 800 });

        const resizeHandle = page.getByRole("separator", { name: "Resize sidebar" });
        await expect(resizeHandle).toHaveAttribute("aria-valuemax", "400");
        const currentWidth = Number(await resizeHandle.getAttribute("aria-valuenow"));
        const bounds = await resizeHandle.boundingBox();
        if (!bounds) throw new Error("Resize handle has no visible bounds.");

        const startX = bounds.x + bounds.width / 2;
        const pointerY = bounds.y + Math.min(bounds.height / 2, 400);
        await page.mouse.move(startX, pointerY);
        await page.mouse.down();
        await page.mouse.move(startX + 400 - currentWidth, pointerY, { steps: 4 });
        await page.mouse.up();
        await expect(resizeHandle).toHaveAttribute("aria-valuenow", "400");

        await page.setViewportSize({ width: 960, height: 800 });
        await expect(resizeHandle).toHaveAttribute("aria-valuemax", "384");
        const sidebarPanel = page.locator(".writeme-aside-panel--open");
        const maxTransitionDuration = await sidebarPanel.evaluate((element) =>
            Math.max(
                ...getComputedStyle(element)
                    .transitionDuration.split(",")
                    .map((duration) => Number.parseFloat(duration)),
            ),
        );
        expect(maxTransitionDuration).toBeLessThanOrEqual(0.001);
        await expect(sidebarPanel).toHaveCSS("width", "384px");
        const constrainedWidth = await sidebarPanel.evaluate((element) => element.getBoundingClientRect().width);
        expect(constrainedWidth).toBeLessThanOrEqual(384);
    });

    test("opens the sidebar as an in-bounds mobile drawer", async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        const openSidebar = page.getByRole("button", { name: "Open workspace menu" });
        await expect(openSidebar).toBeVisible();
        await openSidebar.click();

        const sidebar = page.locator(".writeme-aside-panel--open");
        await expect(sidebar).toBeVisible();
        const bounds = await sidebar.boundingBox();
        if (!bounds) throw new Error("Mobile sidebar has no visible bounds.");
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);

        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(documentWidth).toBeLessThanOrEqual(375);
        await page.setViewportSize({ width: 812, height: 375 });
        const landscapeBounds = await sidebar.boundingBox();
        if (!landscapeBounds) throw new Error("Landscape sidebar has no visible bounds.");
        expect(landscapeBounds.x).toBeGreaterThanOrEqual(0);
        expect(landscapeBounds.x + landscapeBounds.width).toBeLessThanOrEqual(812);

        const landscapeDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(landscapeDocumentWidth).toBeLessThanOrEqual(812);
    });
});
