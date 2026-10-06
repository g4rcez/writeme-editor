import { expect, test } from "@playwright/test";

const releaseAssetsUrl = "https://github.com/g4rcez/writeme-editor/releases/download/v1.1.0";
const releaseNotesUrl = "https://github.com/g4rcez/writeme-editor/blob/v1.1.0/CHANGELOG.md";
const releasePageUrl = "https://github.com/g4rcez/writeme-editor/releases/tag/v1.1.0";
const downloadLinks = [
    {
        label: "Download Windows .exe",
        href: `${releaseAssetsUrl}/writeme-1.1.0-setup.exe`,
    },
    {
        label: "Download macOS .dmg",
        href: `${releaseAssetsUrl}/writeme-1.1.0-arm64-unsigned.dmg`,
    },
    {
        label: "Download Linux .deb",
        href: `${releaseAssetsUrl}/writeme-1.1.0-amd64.deb`,
    },
    {
        label: "Download Linux .rpm",
        href: `${releaseAssetsUrl}/writeme-1.1.0-x86_64.rpm`,
    },
];

test("landing links to the available desktop packages", async ({ page }) => {
    await page.goto("/");

    const downloads = page.getByRole("region", { name: "Desktop downloads" });
    await expect(downloads).toBeVisible();

    for (const download of downloadLinks) {
        await expect(downloads.getByRole("link", { name: download.label })).toHaveAttribute("href", download.href);
    }
    await expect(downloads.getByRole("link", { name: "v1.1.0 changelog" })).toHaveAttribute("href", releaseNotesUrl);
    await expect(downloads.getByRole("link", { name: "release page" })).toHaveAttribute("href", releasePageUrl);

    await page.setViewportSize({ width: 375, height: 812 });
    for (const download of downloadLinks) {
        await expect(downloads.getByRole("link", { name: download.label })).toBeVisible();
    }

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(375);
});

test("landing uses Write Me purple and the hive responds to hover", async ({ page }) => {
    await page.goto("/");
    const headlineAccent = await page.locator("#hero-title .text-primary").evaluate((element) =>
        getComputedStyle(element).color
    );
    expect(headlineAccent).toBe("rgb(184, 153, 255)");

    const primaryAction = page.locator("#main-content").getByRole("button", { name: "Start writing" });
    await expect(primaryAction).toHaveCSS("background-color", headlineAccent);

    const cell = page.locator("#main-content .hive-cell").nth(22);
    await expect(cell).toBeVisible();
    const restingBorderColor = await cell.evaluate((element) =>
        getComputedStyle(element, "::before").backgroundColor
    );
    const restingHueMatch = restingBorderColor.match(/oklch\(\s*[\d.]+%?\s+[\d.]+\s+([\d.]+)/);
    expect(restingHueMatch).not.toBeNull();
    const restingHue = Number(restingHueMatch?.[1]);
    expect(restingHue).toBeGreaterThan(270);
    expect(restingHue).toBeLessThan(320);

    const restingFilter = await cell.evaluate((element) =>
        getComputedStyle(element).filter
    );
    expect(restingFilter).toBe("none");
    await cell.hover();

    await expect.poll(() =>
        cell.evaluate((element) => getComputedStyle(element).filter)
    ).not.toBe(restingFilter);
    await expect.poll(() =>
        cell.evaluate((element) => getComputedStyle(element).filter)
    ).not.toContain("rgba(0, 0, 0, 0)");
});
