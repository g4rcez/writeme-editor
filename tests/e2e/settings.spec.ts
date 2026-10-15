import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const webDestinations = [
    { title: "Editor", path: "/settings/editor" },
    { title: "Templates", path: "/settings/templates" },
    { title: "Appearance", path: "/settings/appearance" },
    { title: "Variables", path: "/settings/variables" },
    { title: "AI", path: "/settings/ai" },
];

const saveSettings = async (page: Page, section: "Editor"): Promise<void> => {
    await page
        .getByRole("main", { name: "Settings" })
        .getByRole("button", { name: `Save ${section}`, exact: true })
        .click();
    const confirmation = page.getByRole("dialog", { name: "Success", exact: true });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "OK", exact: true }).click();
    await expect(confirmation).toBeHidden();
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
    const main = page.getByRole("main", { name: "Settings" });
    await expect
        .poll(() =>
            main.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const containers = [
                    document.documentElement,
                    document.body,
                    element,
                    ...element.querySelectorAll("section, form, fieldset"),
                ];
                const overflow = containers
                    .filter(
                        (container) => container.clientWidth > 0 && container.scrollWidth > container.clientWidth + 1,
                    )
                    .map(
                        (container) =>
                            `${container.tagName} overflows by ${container.scrollWidth - container.clientWidth}px`,
                    );
                for (const control of element.querySelectorAll("h1, h2, input, select, textarea, button")) {
                    const rect = control.getBoundingClientRect();
                    if (
                        rect.width > 0 &&
                        rect.height > 0 &&
                        (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
                    ) {
                        overflow.push(
                            `${control.getAttribute("aria-label") ?? control.textContent ?? control.tagName} is clipped horizontally`,
                        );
                    }
                }
                return overflow;
            }),
        )
        .toEqual([]);
};

test.describe("Settings", () => {

    test("page renders core sections", async ({ cleanPage: page }) => {
        await page.goto("/settings/editor", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
        await expect(page.getByText("Autosave", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Save Editor/ })).toBeVisible();
    });

    test("reaches web settings through section links and updates the active route", async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto("/settings/quick", { waitUntil: "domcontentloaded" });
        const navigation = page.getByRole("navigation", { name: "Settings sections", exact: true });
        await expect(navigation).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Workspace views", exact: true })).toBeHidden();
        await expect(navigation.getByRole("link", { name: "Quick settings", exact: true })).toHaveAttribute(
            "aria-current",
            "page",
        );

        for (const destination of webDestinations) {
            await test.step(`Open ${destination.title}`, async () => {
                const link = navigation.getByRole("link", { name: destination.title, exact: true });
                await link.click();
                await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
                await expect(
                    page
                        .getByRole("main", { name: "Settings" })
                        .getByRole("heading", { name: destination.title, exact: true }),
                ).toBeVisible();
                await expect(link).toHaveAttribute("aria-current", "page");
                await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
            });
        }

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(navigation.getByRole("link", { name: "AI", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);

        await page.getByRole("button", { name: "Explorer", exact: true }).click();
        await expect(page.getByRole("navigation", { name: "Workspace views", exact: true })).toBeVisible();
        await expect(navigation).toBeHidden();
        await page.getByRole("button", { name: "Settings", exact: true }).first().click();
        await expect(navigation).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Workspace views", exact: true })).toBeHidden();
    });

    test("activates settings section links with the keyboard", async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto("/settings/editor", { waitUntil: "domcontentloaded" });
        const navigation = page.getByRole("navigation", { name: "Settings sections", exact: true });
        const editor = navigation.getByRole("link", { name: "Editor", exact: true });
        const templates = navigation.getByRole("link", { name: "Templates", exact: true });
        await expect(editor).toHaveAttribute("aria-current", "page");
        await templates.focus();
        await expect(templates).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(templates).not.toBeFocused();
        await page.keyboard.press("Tab");
        await expect(templates).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/settings\/templates$/);
        await expect(
            page.getByRole("main", { name: "Settings" }).getByRole("heading", { name: "Templates", exact: true }),
        ).toBeVisible();
        await expect(templates).toHaveAttribute("aria-current", "page");
        await expect(editor).not.toHaveAttribute("aria-current", "page");
    });

    test("persists editor preferences and retains the delay when Autosave is disabled", async ({ cleanPage: page }) => {
        await page.goto("/settings/editor", { waitUntil: "domcontentloaded" });
        const main = page.getByRole("main", { name: "Settings" });
        const autosave = main.getByRole("checkbox", { name: "Autosave", exact: true });
        const delay = main.getByRole("textbox", { name: "Autosave delay", exact: true });
        const mode = main.getByRole("combobox", { name: "Default editor mode", exact: true });
        const vim = main.getByRole("checkbox", { name: "Vim mode", exact: true });
        const fontSize = main.getByRole("textbox", { name: "Editor font size", exact: true });
        await autosave.check();
        await delay.fill("1750");
        await mode.selectOption("markdown");
        await vim.check();
        await fontSize.fill("19");
        await saveSettings(page, "Editor");

        await autosave.uncheck();
        await expect(delay).toBeHidden();
        await saveSettings(page, "Editor");
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(autosave).not.toBeChecked();
        await expect(delay).toBeHidden();
        await expect(mode).toHaveValue("markdown");
        await expect(vim).toBeChecked();
        await expect(fontSize).toHaveValue("19");

        await autosave.check();
        await expect(delay).toHaveValue("1750");
        await saveSettings(page, "Editor");
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(autosave).toBeChecked();
        await expect(delay).toHaveValue("1750");
    });

    for (const theme of ["light", "dark"] as const) {
        for (const viewport of [
            { name: "desktop", width: 1280, height: 900 },
            { name: "small viewport", width: 375, height: 812 },
        ]) {
            test(`keeps settings reachable without horizontal overflow (${theme}, ${viewport.name}, reduced motion)`, async ({
                cleanPage: page,
            }, testInfo) => {
                await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
                await page.setViewportSize({ width: 1280, height: 900 });
                await page.goto("/settings/appearance", { waitUntil: "domcontentloaded" });
                await page
                    .getByRole("main", { name: "Settings" })
                    .getByRole("combobox", { name: "Theme", exact: true })
                    .selectOption(theme);
                await page.getByRole("button", { name: "Save Appearance", exact: true }).click();
                await page.reload({ waitUntil: "domcontentloaded" });
                await expect(
                    page.getByRole("main", { name: "Settings" }).getByRole("combobox", { name: "Theme", exact: true }),
                ).toHaveValue(theme);
                await page.setViewportSize({ width: viewport.width, height: viewport.height });

                const main = page.getByRole("main", { name: "Settings" });
                const navigation = page.getByRole("navigation", { name: "Settings sections", exact: true });
                const narrow = viewport.width < 768;
                if (narrow) await expect(navigation).toBeHidden();

                for (const destination of webDestinations) {
                    await test.step(`Navigate to ${destination.title}`, async () => {
                        if (narrow) {
                            await main.getByRole("button", { name: "Open workspace menu", exact: true }).click();
                        }
                        await expect(navigation).toBeVisible();
                        const link = navigation.getByRole("link", { name: destination.title, exact: true });
                        await link.click();
                        await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
                        await expect(link).toHaveAttribute("aria-current", "page");
                        if (narrow) {
                            await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
                            await expect(navigation).toBeHidden();
                            await expect(
                                main.getByRole("button", { name: "Open workspace menu", exact: true }),
                            ).toBeVisible();
                        }
                        await expect(main.getByRole("heading", { name: destination.title, exact: true })).toBeVisible();
                        if (destination.title === "Variables") {
                            await main.getByRole("button", { name: "Add Variable", exact: true }).click();
                            await expect(main.getByRole("textbox", { name: /^JavaScript expression:/ })).toBeVisible();
                        }
                        if (destination.title === "AI") {
                            await expect(
                                main.getByRole("button", { name: "Save Configuration", exact: true }),
                            ).toBeVisible();
                        }
                        await expectNoHorizontalOverflow(page);
                        await testInfo.attach(`${destination.title}-${theme}-${viewport.width}px`, {
                            body: await page.screenshot(),
                            contentType: "image/png",
                        });
                    });
                }
            });
        }
    }

    test("Native theme follows the system light and dark appearance", async ({ cleanPage: page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto("/settings/appearance", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
        await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption("native");
        await page.getByRole("button", { name: "Save Appearance" }).click();

        const nativeColorsMatchOs = () =>
            page.evaluate(() => {
                const probe = document.createElement("span");
                document.documentElement.append(probe);

                probe.style.backgroundColor = "Canvas";
                const systemBackground = getComputedStyle(probe).backgroundColor;
                probe.style.backgroundColor = "var(--var-color-background)";
                const themeBackground = getComputedStyle(probe).backgroundColor;

                probe.style.color = "CanvasText";
                const systemForeground = getComputedStyle(probe).color;
                probe.style.color = "var(--var-color-foreground)";
                const themeForeground = getComputedStyle(probe).color;

                probe.style.backgroundColor = "AccentColor";
                const systemAccent = getComputedStyle(probe).backgroundColor;
                probe.style.backgroundColor = "var(--var-color-primary)";
                const themeAccent = getComputedStyle(probe).backgroundColor;

                probe.style.color = "color-mix(in srgb, ButtonBorder 84%, Canvas)";
                const softenedSystemBorder = getComputedStyle(probe).color;
                probe.style.color = "var(--var-color-border)";
                const themeBorder = getComputedStyle(probe).color;
                probe.remove();

                return (
                    systemBackground === themeBackground &&
                    systemForeground === themeForeground &&
                    systemAccent === themeAccent &&
                    softenedSystemBorder === themeBorder
                );
            });
        await expect.poll(nativeColorsMatchOs).toBe(true);

        await page.emulateMedia({ colorScheme: "dark" });
        await expect.poll(nativeColorsMatchOs).toBe(true);
    });
});
