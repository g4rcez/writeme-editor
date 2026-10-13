import { expect, goHome, test } from "./fixtures";

test.describe("Settings", () => {
    test.beforeEach(async ({ cleanPage }) => {
        await goHome(cleanPage);
    });

    test("page renders core sections", async ({ cleanPage: page }) => {
        await page.goto("/settings/editor");
        await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
        await expect(page.getByText("Autosave", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Save Editor/ })).toBeVisible();
    });

    test("Native theme follows the system light and dark appearance", async ({ cleanPage: page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto("/settings/appearance");
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
