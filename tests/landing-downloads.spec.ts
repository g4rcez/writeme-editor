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
    await expect(
        page.getByRole("img", {
            name: "Write Me's workspace home with quick actions, recently changed notes, and starred notes.",
        }),
    ).toBeVisible();

    for (const download of downloadLinks) {
        const action = downloads.getByRole("link", { name: download.label });
        await expect(action).toHaveAttribute("href", download.href);
        await expect(action).toHaveAttribute("data-slot", "button");
    }
    await expect(downloads.getByRole("link", { name: "v1.1.0 changelog" })).toHaveAttribute("href", releaseNotesUrl);
    await expect(downloads.getByRole("link", { name: "release page" })).toHaveAttribute("href", releasePageUrl);

    for (const width of [320, 375, 414, 768]) {
        await page.setViewportSize({ width, height: 812 });
        for (const download of downloadLinks) {
            await expect(downloads.getByRole("link", { name: download.label })).toBeVisible();
        }

        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(documentWidth, `document should not overflow at ${width}px`).toBeLessThanOrEqual(width);
    }
});

test("navigation links stay centered and Start writing stays right-aligned", async ({ page }) => {
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    const links = navigation.locator(".navigation-links");
    const action = navigation.getByRole("link", { name: "Start writing" });
    await expect(action).toHaveAttribute("data-slot", "button");

    for (const width of [320, 640, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 812 });
        await expect(action).toBeVisible();

        if (width < 640) {
            await expect(links).toBeHidden();
        } else {
            await expect(links).toBeVisible();
            const navCenter = await navigation.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.left + bounds.width / 2;
            });
            const linksCenter = await links.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.left + bounds.width / 2;
            });
            expect(Math.abs(linksCenter - navCenter)).toBeLessThanOrEqual(1);
        }

        const navRight = await navigation.evaluate((element) => element.getBoundingClientRect().right);
        const actionRight = await action.evaluate((element) => element.getBoundingClientRect().right);
        const rightInset = await navigation.evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).paddingRight),
        );
        expect(Math.abs(navRight - actionRight - rightInset)).toBeLessThanOrEqual(1);
    }
});

test("landing uses Write Me purple and the hive responds to hover", async ({ page }) => {
    await page.goto("/");
    const headlineAccent = await page
        .locator("#hero-title .text-primary")
        .evaluate((element) => getComputedStyle(element).color);
    expect(headlineAccent).toBe("rgb(184, 153, 255)");

    const primaryAction = page.locator("#main-content").getByRole("link", { name: "Start writing" });
    await expect(primaryAction).toHaveAttribute("data-slot", "button");
    await expect(primaryAction).toHaveCSS("background-color", headlineAccent);

    const headerAction = page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Start writing" });
    const secondaryAction = page.locator("#main-content").getByRole("link", { name: "Download desktop" });
    const webAction = page.getByRole("link", { name: "Open web app" });
    const downloadAction = page
        .getByRole("region", { name: "Desktop downloads" })
        .getByRole("link", { name: "Download Windows .exe" });

    await expect(secondaryAction).toHaveAttribute("data-slot", "button");
    await expect(secondaryAction).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(secondaryAction).toHaveCSS("border-top-style", "solid");
    await expect(webAction).toHaveAttribute("data-slot", "button");
    await expect(webAction).toHaveCSS("background-color", headlineAccent);
    await expect(downloadAction).toHaveAttribute("data-slot", "button");
    await expect(downloadAction).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    const actionRadii = await Promise.all(
        [headerAction, primaryAction, secondaryAction, webAction, downloadAction].map((action) =>
            action.evaluate((element) => getComputedStyle(element).borderRadius),
        ),
    );
    expect(new Set(actionRadii).size).toBe(1);

    const cell = page.locator("#main-content .hive-cell").nth(22);
    await expect(cell).toBeVisible();
    const restingBorderColor = await cell.evaluate((element) => getComputedStyle(element, "::before").backgroundColor);
    const restingHueMatch = restingBorderColor.match(/oklch\(\s*[\d.]+%?\s+[\d.]+\s+([\d.]+)/);
    expect(restingHueMatch).not.toBeNull();
    const restingHue = Number(restingHueMatch?.[1]);
    expect(restingHue).toBeGreaterThan(270);
    expect(restingHue).toBeLessThan(320);

    const restingFilter = await cell.evaluate((element) => getComputedStyle(element).filter);
    expect(restingFilter).toBe("none");
    await cell.hover();

    await expect.poll(() => cell.evaluate((element) => getComputedStyle(element).filter)).not.toBe(restingFilter);
    await expect
        .poll(() => cell.evaluate((element) => getComputedStyle(element).filter))
        .not.toContain("rgba(0, 0, 0, 0)");
});
