import { expect, type Page, type Locator } from "@playwright/test";

export async function expectCanvasZoomShortcuts(
    page: Page,
    zoom: Locator,
    modifier: "Control" | "Meta" | "ControlOrMeta",
    zoomedPercent = "125%",
): Promise<void> {
    const interfaceSize = await page
        .locator("html")
        .evaluate((element) => getComputedStyle(element).getPropertyValue("--default-size"));
    await expect(zoom).toHaveText("100%");
    await page.keyboard.press(`${modifier}+=`);
    await expect(zoom).toHaveText(zoomedPercent);
    await page.keyboard.press(`${modifier}+-`);
    await expect(zoom).toHaveText("100%");
    await page.keyboard.press(`${modifier}+=`);
    await expect(zoom).toHaveText(zoomedPercent);
    await page.keyboard.press(`${modifier}+0`);
    await expect(zoom).toHaveText("100%");
    await page.keyboard.press(`${modifier}+-`);
    await expect(zoom).not.toHaveText("100%");
    await page.keyboard.press(`${modifier}+0`);
    await expect(zoom).toHaveText("100%");
    await expect
        .poll(() =>
            page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--default-size")),
        )
        .toBe(interfaceSize);
}

export async function expectCanvasZoomWheel(page: Page, input: "native" | "dom" = "native"): Promise<void> {
    const footer = page.getByRole("button", { name: "Reset zoom", exact: true });
    const viewport = page.locator(".wm-paper-viewport");
    const before = await viewport.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop }));
    async function scroll(control: Locator, deltaY: number, percentage: number): Promise<void> {
        await control.hover();
        if (input === "dom") {
            const prevented = await control.evaluate(
                (element, delta) =>
                    !element.dispatchEvent(new WheelEvent("wheel", { deltaY: delta, bubbles: true, cancelable: true })),
                deltaY,
            );
            expect(prevented).toBe(true);
        } else await page.mouse.wheel(0, deltaY);
        await expect(footer).toHaveText(`${percentage}%`);
    }
    await scroll(footer, -100, 115);
    await scroll(footer, 100, 100);
    await page.getByRole("button", { name: "Notebook options", exact: true }).click();
    const options = page.getByRole("dialog", { name: "Notebook options", exact: true });
    const zoomGroup = options.getByRole("group", { name: "Page zoom", exact: true });
    await zoomGroup.scrollIntoViewIfNeeded();
    const panelScroll = await options.evaluate((element) => element.scrollTop);
    await scroll(zoomGroup, -100, 115);
    await expect(zoomGroup).toContainText("115%");
    await scroll(zoomGroup, 100, 100);
    expect(await options.evaluate((element) => element.scrollTop)).toBe(panelScroll);
    await page.getByRole("button", { name: "Close options", exact: true }).click();
    await page.getByRole("button", { name: "Notebook options", exact: true }).click();
    await scroll(zoomGroup, -100, 115);
    await page.getByRole("button", { name: "Close options", exact: true }).click();
    for (let value = 130; value < 300; value += 15) await scroll(footer, -100, value);
    await scroll(footer, -100, 300);
    await scroll(footer, -100, 300);
    for (let value = 285; value >= 50; value -= 15) await scroll(footer, 100, value);
    await scroll(footer, 100, 50);
    await scroll(footer, 100, 50);
    expect(await viewport.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop }))).toEqual(before);
    await footer.click();
    await expect(footer).toHaveText("100%");
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(0);
}
