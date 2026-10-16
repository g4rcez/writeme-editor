import { expect, test } from "@playwright/test";
import { expectSavedNotebook, writeNotebook } from "../helpers/handwriting";

test.describe("production pen dots", { tag: ["@production", "@production-only"] }, () => {
    test("renders pen taps as visible dots and retains them after reload", async ({ page }) => {
        await page.goto("/");
        await writeNotebook(page);
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        for (const [index, pen] of [
            { style: "fountain", label: "Fountain pen" },
            { style: "ball", label: "Ball pen" },
            { style: "brush", label: "Brush pen" },
            { style: "pencil", label: "Pencil" },
        ].entries()) {
            const trigger = page.getByRole("button", { name: "Pen", exact: true });
            if ((await trigger.getAttribute("aria-pressed")) !== "true") await trigger.click();
            await trigger.click();
            await page.getByRole("button", { name: pen.label, exact: true }).click();
            await page.getByRole("button", { name: "Close options", exact: true }).click();
            const bounds = await canvas.boundingBox();
            if (!bounds) throw new Error("Canvas is not visible");
            await page.mouse.click(bounds.x + 100 + index * 30, bounds.y + 180);
            await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
            const dot = canvas.locator(`[data-pen-style="${pen.style}"]`).last();
            const dimensions = await dot.evaluate((element) => {
                if (!(element instanceof SVGGraphicsElement)) throw new Error("Missing SVG ink");
                const box = element.getBBox();
                return { width: box.width, height: box.height };
            });
            expect(dimensions.width, `${pen.label} dot width`).toBeGreaterThan(0);
            expect(dimensions.height, `${pen.label} dot height`).toBeGreaterThan(0);
        }
        await expectSavedNotebook(page, 5);
        const paths = await canvas
            .locator("[data-ink-stroke]")
            .evaluateAll((elements) => elements.map((element) => element.getAttribute("d")));
        await page.reload();
        await expectSavedNotebook(page, 5);
        expect(
            await canvas
                .locator("[data-ink-stroke]")
                .evaluateAll((elements) => elements.map((element) => element.getAttribute("d"))),
        ).toEqual(paths);
    });
});
