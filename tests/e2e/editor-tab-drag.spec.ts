import type { Locator, Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

test.setTimeout(90_000);

async function createNote(page: Page, title: string): Promise<void> {
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(title);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page.getByRole("dialog", { name: /Create new note/i })).not.toBeVisible();
    await expect(page.getByRole("textbox", { name: "Note title", exact: true })).toHaveValue(title);
    await expect(page.locator(".writeme-tabs-bar-list [data-tab-id]").filter({ hasText: title })).toBeVisible();
}

test("reorders group tabs, nests splits, and collapses an emptied source group", async ({
    cleanPage: page,
}, testInfo) => {
    await goHome(page);
    await createNote(page, "Reference tab");
    await createNote(page, "Extra tab");
    await createNote(page, "Working tab");
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect
        .poll(async () => (await page.locator(".writeme-editor-drop-target").first().boundingBox())?.width ?? 0)
        .toBeGreaterThan(1100);
    await dragToEdge(
        page.locator(".writeme-tabs-bar-list [data-tab-id]").filter({ hasText: "Reference tab" }),
        page.locator(".writeme-editor-drop-target").first(),
        "right",
    );
    await expect(page.getByRole("tablist")).toHaveCount(2);
    const first = page.getByRole("region", { name: "Editor group 1", exact: true });
    await dragTab(
        first.getByRole("tab", { name: "Extra tab", exact: true }),
        first.getByRole("tab", { name: "Working tab", exact: true }),
        { x: 4, y: 12 },
    );
    await expect(first.getByRole("tab").first()).toHaveText("Extra tab");
    await first.getByRole("tab", { name: "Working tab", exact: true }).click();
    await first.getByRole("tab", { name: "Working tab", exact: true }).press("ArrowLeft");
    await expect(first.getByRole("tab", { name: "Extra tab", exact: true })).toHaveAttribute("aria-selected", "true");
    await first.getByRole("tab", { name: "Extra tab", exact: true }).press("ArrowRight");
    await dragToEdge(
        first.getByRole("tab", { name: "Extra tab", exact: true }),
        first.locator(".writeme-editor-drop-target"),
        "top",
    );
    const third = page.getByRole("region", { name: "Editor group 3", exact: true });
    const second = page.getByRole("region", { name: "Editor group 2", exact: true });
    await expect(third).toBeVisible();
    const a = await first.boundingBox();
    const b = await second.boundingBox();
    const c = await third.boundingBox();
    if (!a || !b || !c) throw new Error("Expected three editor groups");
    expect(c.y).toBeLessThan(a.y);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.height).toBeGreaterThan(a.height);
    await page.screenshot({ path: testInfo.outputPath("nested-editor-groups.png") });
    await dragTab(second.getByRole("tab", { name: "Reference tab", exact: true }), first.getByRole("tablist"));
    await expect(page.getByRole("tablist")).toHaveCount(2);
    await expect(first.getByRole("tab", { name: "Reference tab", exact: true })).toBeVisible();
    await first.getByRole("tab", { name: "Working tab", exact: true }).click();
    await page.locator(".writeme-tabs-bar-list [data-tab-id]").filter({ hasText: "Extra tab" }).click();
    await expect(first.getByRole("tab", { name: "Extra tab", exact: true })).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(2);
});

test("previews an edge split and leaves the layout intact when dragging is canceled", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Reference tab");
    await createNote(page, "Working tab");
    const source = await page
        .locator(".writeme-tabs-bar-list [data-tab-id]")
        .filter({ hasText: "Reference tab" })
        .boundingBox();
    const target = await page.locator(".writeme-editor-drop-target").boundingBox();
    if (!source || !target) throw new Error("Expected a tab and an editor");
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
    await page.mouse.move(target.x + target.width - 8, target.y + target.height / 2, { steps: 3 });
    await page.mouse.move(target.x + target.width - 9, target.y + target.height / 2);
    await expect(page.getByLabel("Drop tab right", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".writeme-editor-drop-preview")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Note title", exact: true })).toHaveValue("Working tab");
});

test("copies a dragged tab with the platform modifier", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Reference tab");
    await createNote(page, "Working tab");
    await dragToEdge(
        page.locator(".writeme-tabs-bar-list [data-tab-id]").filter({ hasText: "Reference tab" }),
        page.locator(".writeme-editor-drop-target").first(),
        "right",
    );
    const first = page.getByRole("region", { name: "Editor group 1", exact: true });
    const second = page.getByRole("region", { name: "Editor group 2", exact: true });
    const modifier = process.platform === "darwin" ? "Alt" : "Control";
    await page.keyboard.down(modifier);
    await dragToEdge(
        second.getByRole("tab", { name: "Reference tab", exact: true }),
        first.locator(".writeme-editor-drop-target"),
        "bottom",
    );
    await page.keyboard.up(modifier);
    await expect(page.getByRole("tab", { name: "Reference tab", exact: true })).toHaveCount(2);
    await expect(page.getByRole("tablist")).toHaveCount(3);
    await page.getByRole("button", { name: "Close Reference tab in group 3", exact: true }).click();
    await expect(page.getByRole("tablist")).toHaveCount(2);
    await expect(second.getByRole("tab", { name: "Reference tab", exact: true })).toBeVisible();
});

async function dragToEdge(tab: Locator, target: Locator, side: string): Promise<void> {
    const box = await target.boundingBox();
    if (!box) throw new Error("Expected an editor drop target");
    await dragTab(tab, target, {
        x: side === "left" ? 8 : side === "right" ? box.width - 8 : box.width / 2,
        y: side === "top" ? 8 : side === "bottom" ? box.height - 8 : box.height / 2,
    });
}

async function dragTab(tab: Locator, target: Locator, point?: { x: number; y: number }): Promise<void> {
    await tab.scrollIntoViewIfNeeded();
    const source = await tab.boundingBox();
    const destination = await target.boundingBox();
    if (!source || !destination) throw new Error("Expected visible drag source and target");
    const page = tab.page();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2, { steps: 3 });
    await page.mouse.move(
        destination.x + (point?.x ?? destination.width / 2),
        destination.y + (point?.y ?? destination.height / 2),
        { steps: 10 },
    );
    await expect(page.locator("[data-motion-tab-ghost]")).toBeVisible();
    await page.mouse.up();
    await expect(page.locator("[data-motion-tab-ghost]")).toHaveCount(0);
}

test("reorders tabs and preserves the order after reload", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "First tab");
    await createNote(page, "Second tab");
    const tabs = page.locator(".writeme-tabs-bar-list [data-tab-id]");
    await dragTab(tabs.filter({ hasText: "First tab" }), tabs.filter({ hasText: "First tab" }));
    await expect(tabs.first()).toContainText("First tab");
    await dragTab(tabs.filter({ hasText: "Second tab" }), tabs.filter({ hasText: "First tab" }), { x: 4, y: 12 });
    await expect(tabs.first()).toContainText("Second tab");
    await page.reload();
    await expect(tabs.first()).toContainText("Second tab");
});

test("supports reduced motion, keyboard activation, and closing a tab after dragging", async ({ cleanPage: page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await goHome(page);
    await createNote(page, "First tab");
    await createNote(page, "Second tab");
    const tabs = page.locator(".writeme-tabs-bar-list [data-tab-id]");
    await dragTab(tabs.filter({ hasText: "Second tab" }), tabs.filter({ hasText: "First tab" }), { x: 4, y: 12 });
    await expect(tabs.first()).toContainText("Second tab");
    await expect
        .poll(() => tabs.last().evaluate((element) => getComputedStyle(element.parentElement!).transform))
        .toBe("none");
    await tabs.filter({ hasText: "First tab" }).click();
    await expect(page.getByRole("textbox", { name: "Note title", exact: true })).toHaveValue("First tab");
    await tabs.filter({ hasText: "Second tab" }).press("Enter");
    await expect(page.getByRole("textbox", { name: "Note title", exact: true })).toHaveValue("Second tab");
    await page.getByRole("button", { name: "Close Second tab", exact: true }).click();
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toContainText("First tab");
});

test("moves a tab to the empty end of the strip", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "First tab");
    await createNote(page, "Second tab");
    const tabs = page.locator(".writeme-tabs-bar-list [data-tab-id]");
    const list = page.locator(".writeme-tabs-bar-list");
    const rect = await list.boundingBox();
    if (!rect) throw new Error("Expected a tab strip");
    await dragTab(tabs.filter({ hasText: "First tab" }), list, { x: rect.width - 8, y: rect.height / 2 });
    await expect(tabs.last()).toContainText("First tab");
});

for (const side of ["left", "right", "top", "bottom"]) {
    test(`drops a tab at the ${side} edge to create an editor group`, async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Reference tab");
        await createNote(page, "Working tab");
        const target = page.locator(".writeme-editor-drop-target").first();
        await dragToEdge(
            page.locator(".writeme-tabs-bar-list [data-tab-id]").filter({ hasText: "Reference tab" }),
            target,
            side,
        );
        const reference = page
            .getByRole("region", { name: /Editor group \d+$/, exact: false })
            .filter({ has: page.getByRole("tab", { name: "Reference tab", exact: true }) });
        const working = page
            .getByRole("region", { name: /Editor group \d+$/, exact: false })
            .filter({ has: page.getByRole("tab", { name: "Working tab", exact: true }) });
        await expect(reference).toHaveCount(1);
        await expect(working).toHaveCount(1);
        const a = await reference.boundingBox();
        const b = await working.boundingBox();
        if (!a || !b) throw new Error("Expected both editor groups");
        expect(
            side === "left" ? a.x < b.x : side === "right" ? a.x > b.x : side === "top" ? a.y < b.y : a.y > b.y,
        ).toBe(true);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toHaveCount(2);
    });
}
