import { createNote, expect, goHome, test } from "./fixtures";

for (const theme of ["dark", "light"] as const) {
    test(`preserves activity-bar styling and actions (${theme})`, async ({ cleanPage: page }) => {
        await page.goto("/settings/appearance");
        await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
        await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
        await goHome(page);
        await createNote(page, "Activity-bar styling", "Favorite badge fixture.");
        await page.getByRole("button", { name: "Add to favorites", exact: true }).click();

        const navigation = page.getByRole("navigation", { name: "Workspace navigation", includeHidden: true });
        const explorer = navigation.getByRole("button", { name: "Explorer", exact: true });
        const search = navigation.getByRole("button", { name: "Search", exact: true });
        const favorites = navigation.getByRole("button", { name: "Favorites", exact: true });
        await expect(navigation).toHaveCSS("width", "48px");
        await expect(explorer).toHaveCSS("width", "32px");
        await expect(favorites.locator(".writeme-aside-activity-badge")).toHaveText("1");
        await expect(favorites.locator(".writeme-aside-activity-badge")).toHaveCSS("font-size", "10px");
        await expect(search).toHaveAttribute("title", "Search");

        await search.click();
        await expect(search).toHaveAttribute("aria-pressed", "true");
        await expect(explorer).toHaveAttribute("aria-pressed", "false");
        const primaryColor = await search
            .locator(".writeme-aside-activity-indicator")
            .evaluate((element) => getComputedStyle(element).backgroundColor);
        await expect(search).toHaveCSS("color", primaryColor);
        await search.focus();
        await expect(search).toBeFocused();

        await navigation.getByRole("button", { name: "Collapse Sidebar", exact: true }).click();
        await expect(navigation.getByRole("button", { name: "Expand Sidebar", exact: true })).toBeVisible();
        await navigation.getByRole("button", { name: "Expand Sidebar", exact: true }).click();
        await expect(navigation.getByRole("button", { name: "Collapse Sidebar", exact: true })).toBeVisible();

        const originalClasses = await page.evaluate(() => {
            const root = document.documentElement;
            const original = root.className;
            root.classList.add("native", "platform-web");
            return original;
        });
        try {
            const nativeBackground = await navigation.evaluate((element) => {
                const probe = document.createElement("span");
                probe.style.backgroundColor = "var(--var-color-background)";
                element.append(probe);
                const color = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return color;
            });
            await expect(navigation).toHaveCSS("background-color", nativeBackground);
        } finally {
            await page.evaluate((classes) => {
                document.documentElement.className = classes;
            }, originalClasses);
        }

        await page.emulateMedia({ media: "print" });
        await expect(navigation).toHaveCSS("display", "none");
    });

    test(`preserves shell and header styles after CSS cleanup (${theme})`, async ({ cleanPage: page }) => {
        await page.goto("/settings/appearance");
        await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
        await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
        const shells = page.locator(".writeme-settings-shell");
        await expect(shells.first()).toBeVisible();
        for (const shell of await shells.all()) {
            await expect(shell).toHaveCSS("min-height", "100%");
        }
        await goHome(page);
        await expect(page.locator(".writeme-home-shell")).toHaveCSS("min-height", "100%");

        const menu = page.getByRole("button", {
            name: /^(Open|Close) workspace menu$/,
            includeHidden: true,
        });
        const openNote = page.getByRole("button", { name: "Open note", exact: true });
        for (const width of [639, 640, 959, 960]) {
            await page.setViewportSize({ width, height: 900 });
            await expect(openNote).toHaveCSS("width", "32px");
            await expect(openNote).toHaveCSS("height", "32px");
            await expect(openNote).toHaveCSS("border-radius", "0px");
            if (width === 639) {
                await expect(menu).toBeVisible();
                await expect(menu).toHaveCSS("width", "32px");
                await expect(menu).toHaveCSS("height", "32px");
            } else {
                await expect(menu).toBeHidden();
            }
        }

        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(openNote).toHaveCSS("transition-duration", "1e-05s");
        await page.emulateMedia({ media: "print" });
        await expect(page.locator(".writeme-app-header")).toHaveCSS("display", "none");
    });
}

test.describe("touch activity bar", () => {
    test.use({ hasTouch: true });

    test("keeps coarse-pointer controls large", async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await goHome(page);
        expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

        const navigation = page.getByRole("navigation", { name: "Workspace navigation" });
        const search = navigation.getByRole("button", { name: "Search", exact: true });
        await expect(navigation).toHaveCSS("width", "56px");
        await expect(search).toHaveCSS("width", "44px");
        await expect(search).toHaveCSS("height", "44px");
        await search.tap();
        await expect(search).toHaveAttribute("aria-pressed", "true");
    });
});
