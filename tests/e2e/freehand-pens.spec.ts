import { expect, test, type Page } from "@playwright/test";
import { addInk, expectSavedNotebook, writeNotebook } from "../helpers/handwriting";

const pens = [
    { style: "fountain", label: "Fountain pen" },
    { style: "ball", label: "Ball pen" },
    { style: "brush", label: "Brush pen" },
    { style: "pencil", label: "Pencil" },
];

async function openPenTools(page: Page): Promise<void> {
    const pen = page.getByRole("button", { name: "Pen", exact: true });
    if ((await pen.getAttribute("aria-pressed")) !== "true") await pen.click();
    if ((await pen.getAttribute("aria-expanded")) !== "true") await pen.click();
    await expect(page.getByRole("dialog", { name: "Pen tools", exact: true })).toBeVisible();
}

async function selectPen(page: Page, label: string): Promise<void> {
    await openPenTools(page);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Close options", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pen", exact: true })).toBeFocused();
}

async function savedPaths(page: Page): Promise<unknown> {
    return page
        .getByLabel("Handwriting canvas", { exact: true })
        .locator("[data-ink-stroke]")
        .evaluateAll((elements) =>
            elements.map((element) => ({
                path: element.getAttribute("d"),
                style: element.getAttribute("data-pen-style"),
                opacity: element.getAttribute("opacity"),
            })),
        );
}

test("draws, undoes, erases and reloads every pen type in the production app", async ({ page }, testInfo) => {
    await page.goto("/");
    await writeNotebook(page);
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    for (const [index, pen] of pens.entries()) {
        await selectPen(page, pen.label);
        await addInk(page, 280 + index * 50);
        await expect(canvas.locator(`[data-pen-style="${pen.style}"]`)).toHaveCount(pen.style === "fountain" ? 2 : 1);
    }
    await expectSavedNotebook(page, 5);
    const pencil = canvas.locator('[data-pen-style="pencil"]');
    await expect(pencil).toHaveAttribute("fill", /^url\(#/);
    await expect(pencil).toHaveAttribute("opacity", "0.8");
    const original = await savedPaths(page);
    await page.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect(pencil).toHaveCount(0);
    await page.getByRole("button", { name: "Redo drawing", exact: true }).click();
    await expectSavedNotebook(page, 5);
    await page.reload();
    await expectSavedNotebook(page, 5);
    expect(await savedPaths(page)).toEqual(original);
    await expect(pencil).toHaveAttribute("fill", /^url\(#/);
    await page.getByRole("button", { name: "Eraser", exact: true }).click();
    await addInk(page, 430);
    await expect(pencil).toHaveCount(0);
    await expectSavedNotebook(page, 4);
    await page.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expectSavedNotebook(page, 5);
    expect(await savedPaths(page)).toEqual(original);
    await testInfo.attach("Saved pen types", { body: await page.screenshot(), contentType: "image/png" });
});

test("keeps the pen picker compact, reachable and keyboard accessible in both themes", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await writeNotebook(page);
    const source = page.url();
    for (const theme of ["light", "dark"]) {
        await page.goto("/settings/appearance");
        await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
        await page.getByRole("button", { name: "Save Appearance" }).click();
        await page.goto(source);
        for (const viewport of [
            { width: 375, height: 812 },
            { width: 812, height: 375 },
            { width: 820, height: 1180 },
            { width: 1180, height: 820 },
        ]) {
            await page.setViewportSize(viewport);
            await openPenTools(page);
            const panel = page.getByRole("dialog", { name: "Pen tools", exact: true });
            const toolbar = await page.getByRole("toolbar", { name: "Writing tools" }).boundingBox();
            expect(toolbar!.width).toBeLessThanOrEqual(360);
            expect(toolbar!.height).toBeLessThanOrEqual(54);
            for (const pen of pens) {
                const button = panel.getByRole("button", { name: pen.label, exact: true });
                await button.focus();
                await expect(button).toBeInViewport();
                const bounds = await button.boundingBox();
                expect(bounds!.width).toBeGreaterThanOrEqual(44);
                expect(bounds!.height).toBeGreaterThanOrEqual(44);
                expect(bounds!.x).toBeGreaterThanOrEqual(0);
                expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
                expect(bounds!.y).toBeGreaterThanOrEqual(0);
                expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
                expect(
                    await button.evaluate((element) => {
                        const rect = element.getBoundingClientRect();
                        return element.contains(
                            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
                        );
                    }),
                ).toBe(true);
                await button.press("Enter");
                await expect(button).toHaveAttribute("aria-pressed", "true");
            }
            await panel.getByRole("combobox", { name: "Stroke width" }).focus();
            await expect(panel.getByRole("combobox", { name: "Stroke width" })).toBeInViewport();
            await page.screenshot({ path: testInfo.outputPath(`pen-picker-${theme}-${viewport.width}.png`) });
            await page.keyboard.press("Escape");
            await expect(panel).toHaveCount(0);
            await expect(page.getByRole("button", { name: "Pen", exact: true })).toBeFocused();
            await expectSavedNotebook(page);
        }
    }
});

test("uses constant ball width, fountain and brush pressure, and pencil shading @chromium-input", async ({
    page,
    context,
}) => {
    await page.goto("/");
    await writeNotebook(page);
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const session = await context.newCDPSession(page);
    const widths: Record<string, number[]> = {};
    try {
        for (const [index, pen] of pens.entries()) {
            await selectPen(page, pen.label);
            const bounds = await canvas.boundingBox();
            if (!bounds) throw new Error("Canvas is not visible");
            widths[pen.style] = [];
            for (const force of [0.1, 0.9]) {
                const position = {
                    x: bounds.x + 80,
                    y: bounds.y + 300 + index * 30,
                    pointerType: "pen",
                    button: "left",
                } satisfies { x: number; y: number; pointerType: "pen"; button: "left" };
                await session.send("Input.dispatchMouseEvent", {
                    ...position,
                    type: "mousePressed",
                    buttons: 1,
                    clickCount: 1,
                    force,
                });
                for (let step = 1; step <= 12; step++)
                    await session.send("Input.dispatchMouseEvent", {
                        ...position,
                        x: position.x + step * 8,
                        type: "mouseMoved",
                        buttons: 1,
                        force,
                    });
                await session.send("Input.dispatchMouseEvent", {
                    ...position,
                    x: position.x + 96,
                    type: "mouseReleased",
                    buttons: 0,
                    clickCount: 1,
                });
                await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
                const stroke = canvas.locator(`[data-pen-style="${pen.style}"]`).last();
                widths[pen.style]!.push(
                    await stroke.evaluate((element) =>
                        element instanceof SVGGraphicsElement ? element.getBBox().height : 0,
                    ),
                );
            }
        }
        expect(widths.ball![1]).toBeCloseTo(widths.ball![0]!, 3);
        expect(widths.fountain![1]).toBeGreaterThan(widths.fountain![0]!);
        expect(widths.brush![1]! / widths.brush![0]!).toBeGreaterThan(widths.fountain![1]! / widths.fountain![0]!);
        const pencils = canvas.locator('[data-pen-style="pencil"]');
        const light = Number(await pencils.nth(0).getAttribute("opacity"));
        const firm = Number(await pencils.nth(1).getAttribute("opacity"));
        expect(firm - light).toBeGreaterThan(0.2);
        const original = await savedPaths(page);
        await page.reload();
        await expectSavedNotebook(page, 9);
        expect(await savedPaths(page)).toEqual(original);
    } finally {
        await session.detach();
    }
});
