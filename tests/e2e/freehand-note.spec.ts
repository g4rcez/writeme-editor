import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { FreehandNotebook } from "../../packages/editor/src/lib/freehand-note";
import { expectCanvasZoomShortcuts, expectCanvasZoomWheel } from "../helpers/canvas-zoom";
import { navigateHome } from "../helpers/handwriting";
import { expect, goHome, test } from "./fixtures";

async function closeWorkspaceMenu(page: Page): Promise<void> {
    const close = page.getByRole("button", { name: "Close workspace menu", exact: true });
    if (await close.isVisible()) {
        await close.click();
    } else if ((page.viewportSize()?.width ?? 1280) <= 959) {
        const collapse = page.getByRole("button", { name: "Collapse sidebar", exact: true });
        if (await collapse.isVisible()) await collapse.click();
    }
}

async function createHandwrittenNote(page: Page): Promise<void> {
    await goHome(page);
    await closeWorkspaceMenu(page);
    await page.getByRole("button", { name: "Handwritten note", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create handwritten note" });
    await dialog.getByTitle("Note title").fill("Tablet notebook");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page.getByLabel("Handwriting canvas", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".ProseMirror")).toHaveCount(0);
}

test("scrolls both handwritten zoom percentages up and down without scrolling the page", async ({
    page,
    browserName,
    isMobile,
}) => {
    test.slow();
    await createHandwrittenNote(page);
    const input = browserName === "webkit" && isMobile ? "dom" : "native";
    if (input === "dom")
        test.info().annotations.push({
            type: "input",
            description:
                "Playwright mobile WebKit does not support mouse.wheel; dispatch a cancelable wheel event and verify preventDefault instead.",
        });
    await expectCanvasZoomWheel(page, input);
});

for (const modifier of ["Control", "Meta"] as const) {
    test(`${modifier} plus/minus zooms only the handwritten canvas`, async ({ page }) => {
        await createHandwrittenNote(page);
        await page.getByRole("button", { name: "Eraser", exact: true }).click();
        await page.getByLabel("Handwriting canvas", { exact: true }).click();
        await expectCanvasZoomShortcuts(page, page.getByRole("button", { name: "Reset zoom" }), modifier, "115%");
        for (let index = 0; index < 14; index++) await page.keyboard.press(`${modifier}+=`);
        await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("300%");
        for (let index = 0; index < 17; index++) await page.keyboard.press(`${modifier}+-`);
        await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("50%");
        await expect(page.locator("[data-ink-stroke]")).toHaveCount(0);
    });
}

async function draw(page: Page, y = 220): Promise<void> {
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    await expect
        .poll(() =>
            canvas.evaluate((element, offsetY) => {
                const bounds = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(bounds.x + 80, bounds.y + offsetY));
            }, y),
        )
        .toBe(true);
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Canvas not visible");
    await page.mouse.move(bounds.x + 80, bounds.y + y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 180, bounds.y + y, { steps: 12 });
    await page.mouse.up();
}

async function openNotebookOptions(page: Page): Promise<void> {
    const trigger = page.getByRole("button", { name: "Notebook options", exact: true });
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(page.getByRole("dialog", { name: "Notebook options", exact: true })).toBeVisible();
}

async function closeOptions(page: Page): Promise<void> {
    const close = page.getByRole("button", { name: "Close options", exact: true });
    if (await close.isVisible()) await close.click();
}

async function setPaperStyle(page: Page, style: string): Promise<void> {
    await openNotebookOptions(page);
    await page.getByRole("combobox", { name: "Paper style" }).selectOption(style);
    await closeOptions(page);
}

async function selectInk(page: Page, color: string): Promise<void> {
    await page.getByRole("button", { name: "Ink options", exact: true }).click();
    await page.getByRole("button", { name: `${color} ink`, exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Ink options", exact: true })).toHaveCount(0);
}

async function clickNotebookTool(page: Page, name: string): Promise<void> {
    await openNotebookOptions(page);
    await page.getByRole("button", { name, exact: true }).click();
    await closeOptions(page);
}

async function enableTouchDrawing(page: Page): Promise<void> {
    await openNotebookOptions(page);
    await page.getByRole("checkbox", { name: "Draw with touch" }).check();
    await closeOptions(page);
}

async function expectFloatingCanvas(page: Page): Promise<void> {
    await expect
        .poll(async () => {
            const notebook = await page.getByRole("region", { name: "Handwritten notebook" }).boundingBox();
            const viewport = await page.locator(".wm-paper-viewport").boundingBox();
            const workspace = await page.locator("#main-scroll-container").boundingBox();
            const canvas = await page.getByLabel("Handwriting canvas", { exact: true }).boundingBox();
            if (!notebook || !viewport || !workspace || !canvas) return false;
            return (
                Math.abs(notebook.y - workspace.y) < 1 &&
                Math.abs(notebook.height - workspace.height) < 1 &&
                Math.abs(viewport.x - notebook.x) < 1 &&
                Math.abs(viewport.y - notebook.y) < 1 &&
                Math.abs(viewport.width - notebook.width) < 1 &&
                Math.abs(viewport.height - notebook.height) < 1 &&
                Math.abs(canvas.x - viewport.x) < 1 &&
                Math.abs(canvas.y - viewport.y) < 1 &&
                canvas.width >= viewport.width - 1 &&
                canvas.height >= viewport.height - 1
            );
        })
        .toBe(true);
    await expect
        .poll(async () => {
            const toolbar = await page.getByRole("toolbar", { name: "Writing tools" }).boundingBox();
            const bottom = await page.locator(".wm-notebook-bottom").boundingBox();
            const notebook = await page.getByRole("region", { name: "Handwritten notebook" }).boundingBox();
            if (!toolbar || !bottom || !notebook) return false;
            return (
                toolbar.y > notebook.y &&
                toolbar.width <= 360 &&
                toolbar.height <= 54 &&
                toolbar.y + toolbar.height + 44 <= bottom.y &&
                bottom.y + bottom.height < notebook.y + notebook.height
            );
        })
        .toBe(true);
}

async function seedLinkTargets(page: Page): Promise<string> {
    const targetId = await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/global.store.ts");
        const { Note } = await import("/packages/editor/src/store/note.ts");
        const target = Note.new("Project plan", "# Project plan\n\nLinked reference content.");
        const deleted = Note.new("Deleted target", "");
        deleted.deletedAt = new Date();
        const foreign = Note.parse({ title: "Other workspace target", content: "", project: "another-workspace" });
        const targets = [target, deleted, foreign];
        for (const note of targets) await repositories.notes.save(note);
        return target.id;
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Handwriting canvas", { exact: true })).toBeVisible();
    return targetId;
}

async function readNotebook(page: Page): Promise<FreehandNotebook> {
    return page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/global.store.ts");
        const { parseFreehandNote } = await import("/packages/editor/src/lib/freehand-note.ts");
        const note = await repositories.notes.getOne(location.pathname.split("/").at(-1)!);
        if (!note) throw new Error("Handwritten note missing");
        return parseFreehandNote(note.content);
    });
}

async function openLinkPicker(page: Page): Promise<void> {
    await openNotebookOptions(page);
    await page.getByRole("button", { name: "Add note link", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Link a note", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search notes", exact: true })).toBeFocused();
}

async function addProjectLink(page: Page): Promise<void> {
    await openLinkPicker(page);
    await page
        .getByRole("dialog", { name: "Link a note" })
        .getByRole("button", { name: "Project plan", exact: true })
        .click();
    await expect(page.getByRole("group", { name: "Linked note: Project plan", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Link a note" })).toHaveCount(0);
}

test.describe("sticky note links", () => {
    test.use({ hasTouch: true });

    test("adds, moves, saves and follows a sticky note link without changing ink", async ({
        cleanPage: page,
    }, testInfo) => {
        test.slow();
        await createHandwrittenNote(page);
        const sourceUrl = page.url();
        const targetId = await seedLinkTargets(page);
        await openLinkPicker(page);
        const picker = page.getByRole("dialog", { name: "Link a note" });
        await expect(picker.getByRole("button", { name: "Tablet notebook", exact: true })).toHaveCount(0);
        await expect(picker.getByRole("button", { name: "Deleted target", exact: true })).toHaveCount(0);
        await expect(picker.getByRole("button", { name: "Other workspace target", exact: true })).toHaveCount(0);
        await page.getByRole("searchbox", { name: "Search notes" }).fill("zzzzz");
        await expect(picker.getByRole("status")).toHaveText("No notes match your search.");
        await page.getByRole("searchbox", { name: "Search notes" }).press("Escape");
        await expect(picker).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Notebook options", exact: true })).toBeFocused();
        await openLinkPicker(page);
        await page.getByRole("searchbox", { name: "Search notes" }).fill("proj plan");
        await picker.getByRole("button", { name: "Project plan", exact: true }).click();
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.links?.length).toBe(1);
        await draw(page);
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.strokes.length).toBe(1);
        const before = (await readNotebook(page)).pages[0]!.links![0]!;
        const handle = page.getByRole("button", { name: "Move linked note: Project plan", exact: true });
        const bounds = await handle.boundingBox();
        if (!bounds) throw new Error("Sticky move handle missing");
        await page.mouse.move(bounds.x + 22, bounds.y + 22);
        await page.mouse.down();
        await page.mouse.move(bounds.x + 58, bounds.y + 86, { steps: 8 });
        await page.mouse.up();
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]!.y).toBeGreaterThan(before.y);
        const moved = (await readNotebook(page)).pages[0]!.links![0]!;
        await expect(page).toHaveURL(sourceUrl);
        await expect(page.getByText("Tap the paper to move this link.", { exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Undo drawing" }).click();
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]).toEqual(before);
        await page.getByRole("button", { name: "Redo drawing" }).click();
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]).toEqual(moved);
        const card = page.getByRole("group", { name: "Linked note: Project plan", exact: true });
        const width = (await card.boundingBox())!.width;
        await clickNotebookTool(page, "Zoom in");
        expect((await card.boundingBox())!.width).toBeCloseTo(width, 0);
        const anchor = await card.evaluate((element) => {
            const card = element.getBoundingClientRect();
            const paper = element.parentElement!.querySelector("svg")!.getBoundingClientRect();
            return { x: ((card.x - paper.x) / paper.width) * 1000, y: ((card.y - paper.y) / paper.width) * 1000 };
        });
        expect(anchor.x).toBeCloseTo(moved.x, 0);
        expect(anchor.y).toBeCloseTo(moved.y, 0);
        await clickNotebookTool(page, "Move page");
        const beforePan = (await card.boundingBox())!;
        const toolbar = page.getByRole("toolbar", { name: "Writing tools" });
        const toolbarY = (await toolbar.boundingBox())!.y;
        const canvasBounds = (await page.getByLabel("Handwriting canvas", { exact: true }).boundingBox())!;
        await page.mouse.move(canvasBounds.x + 80, canvasBounds.y + 220);
        await page.mouse.down();
        await page.mouse.move(canvasBounds.x + 80, canvasBounds.y + 140, { steps: 8 });
        await page.mouse.up();
        await expect.poll(async () => (await card.boundingBox())!.y).toBeLessThan(beforePan.y - 50);
        expect((await toolbar.boundingBox())!.y).toBeCloseTo(toolbarY, 0);
        expect((await readNotebook(page)).pages[0]!.links![0]).toEqual(moved);
        await page.getByRole("button", { name: "Reset zoom" }).click();
        await page.reload();
        await expect(card).toBeVisible();
        expect((await readNotebook(page)).pages[0]!.links![0]).toEqual(moved);
        await page.screenshot({ path: testInfo.outputPath("sticky-note-link.png") });
        await page.getByRole("link", { name: "Open note: Project plan", exact: true }).click();
        await expect(page).toHaveURL(new URL(`/note/${targetId}`, sourceUrl).href);
        await expect(page.locator(".ProseMirror").first()).toContainText("Linked reference content.");
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await page.goto(sourceUrl);
        await expect(card).toBeVisible();
        await page.evaluate(async (id) => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            const { Note } = await import("/packages/editor/src/store/note.ts");
            const note = await repositories.notes.getOne(id);
            await repositories.notes.update(
                id,
                Note.parse({
                    ...note,
                    title: "Revised plan",
                    content: "# Revised plan\n\nLinked reference content.",
                    updatedAt: new Date(),
                }),
            );
        }, targetId);
        await page.reload();
        await expect(page.getByRole("link", { name: "Open note: Revised plan", exact: true })).toHaveAttribute(
            "href",
            `/note/${targetId}`,
        );
        await page.getByRole("button", { name: "Add page", exact: true }).click();
        await expect(page.locator(".wm-sticky-link")).toHaveCount(0);
        await page.getByRole("button", { name: "Previous page", exact: true }).click();
        await expect(page.getByRole("link", { name: "Open note: Revised plan", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Remove linked note: Revised plan", exact: true }).click();
        await expect(page.locator(".wm-sticky-link")).toHaveCount(0);
        await page.getByRole("button", { name: "Undo drawing" }).click();
        await expect(page.getByRole("link", { name: "Open note: Revised plan", exact: true })).toBeVisible();
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.strokes.length).toBe(1);
    });

    test("moves sticky links with keyboard and touch and keeps missing targets removable", async ({
        cleanPage: page,
    }) => {
        await createHandwrittenNote(page);
        const targetId = await seedLinkTargets(page);
        await addProjectLink(page);
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.links?.length).toBe(1);
        const before = (await readNotebook(page)).pages[0]!.links![0]!;
        const handle = page.getByRole("button", { name: "Move linked note: Project plan", exact: true });
        await handle.focus();
        await handle.press("ArrowRight");
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]!.x).toBe(before.x + 20);
        await handle.tap();
        await expect(page.getByText("Tap the paper to move this link.", { exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(handle).toHaveAttribute("aria-pressed", "false");
        await handle.press("Enter");
        await expect(handle).toHaveAttribute("aria-pressed", "true");
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        const surface = (await canvas.boundingBox())!;
        await page.touchscreen.tap(surface.x + 24, surface.y + 170);
        await expect(handle).toHaveAttribute("aria-pressed", "false");
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]!.x).toBeLessThan(before.x);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(0);
        await page.evaluate(async (id) => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            await repositories.notes.delete(id);
        }, targetId);
        await page.reload();
        await expect(page.getByText("Note unavailable", { exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Open note: Project plan", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Remove linked note: Project plan", exact: true }).click();
        await expect(page.locator(".wm-sticky-link")).toHaveCount(0);
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.links?.length).toBe(0);
    });

    test("keeps sticky link controls usable across themes and mobile orientations", async ({
        cleanPage: page,
    }, testInfo) => {
        await createHandwrittenNote(page);
        await seedLinkTargets(page);
        await addProjectLink(page);
        const sourceUrl = page.url();
        for (const theme of ["dark", "light"]) {
            await page.setViewportSize({ width: 1280, height: 720 });
            await page
                .getByRole("navigation", { name: "Workspace navigation", exact: true })
                .getByRole("button", { name: "Settings", exact: true })
                .click();
            const settingsNavigation = page.getByRole("navigation", { name: "Settings sections", exact: true });
            await expect(settingsNavigation).toBeVisible();
            await settingsNavigation.getByRole("link", { name: "Appearance", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
            await closeWorkspaceMenu(page);
            await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
            await page.getByRole("button", { name: "Save Appearance" }).click();
            await page.locator(`[data-tab-id][href="${new URL(sourceUrl).pathname}"]`).click();
            await expect(page).toHaveURL(sourceUrl);
            for (const [width, height] of [
                [375, 812],
                [812, 375],
            ]) {
                await page.setViewportSize({ width: width!, height: height! });
                const card = page.getByRole("group", { name: "Linked note: Project plan", exact: true });
                await expect(card).toBeVisible({ timeout: 30_000 });
                await expect
                    .poll(() =>
                        card.locator("button, a").evaluateAll((controls) =>
                            controls.every((control) => {
                                const bounds = control.getBoundingClientRect();
                                return (
                                    bounds.x >= 0 &&
                                    bounds.right <= window.innerWidth &&
                                    bounds.y >= 0 &&
                                    bounds.bottom <= window.innerHeight
                                );
                            }),
                        ),
                    )
                    .toBe(true);
                for (const control of await card.locator("button, a").all()) {
                    const bounds = (await control.boundingBox())!;
                    expect(bounds.width).toBeGreaterThanOrEqual(44);
                    expect(bounds.height).toBeGreaterThanOrEqual(44);
                    expect(bounds.x).toBeGreaterThanOrEqual(0);
                    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width!);
                    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height!);
                    await expect
                        .poll(() =>
                            control.evaluate((element) => {
                                const bounds = element.getBoundingClientRect();
                                return element.contains(
                                    document.elementFromPoint(
                                        bounds.x + bounds.width / 2,
                                        bounds.y + bounds.height / 2,
                                    ),
                                );
                            }),
                        )
                        .toBe(true);
                }
                await page.screenshot({ path: testInfo.outputPath(`sticky-${theme}-${width}.png`) });
            }
        }
    });

    test("handles an empty picker and retains sticky links when saving fails", async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        await openLinkPicker(page);
        await expect(page.getByRole("dialog", { name: "Link a note" }).getByRole("status")).toHaveText(
            "Create another note to link it here.",
        );
        await closeOptions(page);
        await seedLinkTargets(page);
        await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            const original = repositories.notes.updateContentIfUnchanged;
            repositories.notes.updateContentIfUnchanged = async () => {
                throw new Error("Storage unavailable");
            };
            window.addEventListener(
                "restore-note-storage",
                () => {
                    repositories.notes.updateContentIfUnchanged = original;
                },
                { once: true },
            );
        });
        await addProjectLink(page);
        await expect(page.locator(".wm-save-state output")).toHaveText("Could not save");
        await expect(page.getByRole("link", { name: "Open note: Project plan", exact: true })).toBeVisible();
        await page.evaluate(() => window.dispatchEvent(new Event("restore-note-storage")));
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.links?.length).toBe(1);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        await page.reload();
        await expect(page.getByRole("link", { name: "Open note: Project plan", exact: true })).toBeVisible();
    });

    test("drags sticky links with pen and touch and discards canceled moves @chromium-input", async ({
        cleanPage: page,
    }) => {
        await createHandwrittenNote(page);
        const sourceUrl = page.url();
        await seedLinkTargets(page);
        await addProjectLink(page);
        await expect.poll(async () => (await readNotebook(page)).pages[0]?.links?.length).toBe(1);
        const handle = page.getByRole("button", { name: "Move linked note: Project plan", exact: true });
        const session = await page.context().newCDPSession(page);
        const initial = (await readNotebook(page)).pages[0]!.links![0]!;
        const bounds = (await handle.boundingBox())!;
        const x = bounds.x + 22;
        const y = bounds.y + 22;
        await session.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x,
            y,
            button: "left",
            buttons: 1,
            clickCount: 1,
            pointerType: "pen",
            force: 0.5,
        });
        await session.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: x + 20,
            y: y + 40,
            buttons: 1,
            pointerType: "pen",
            force: 0.5,
        });
        await session.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: x + 20,
            y: y + 40,
            button: "left",
            buttons: 0,
            clickCount: 1,
            pointerType: "pen",
        });
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]!.y).toBeGreaterThan(initial.y);
        const penPosition = (await readNotebook(page)).pages[0]!.links![0]!;
        let currentBounds = (await handle.boundingBox())!;
        const touchPoint = { x: currentBounds.x + 22, y: currentBounds.y + 22, id: 1, radiusX: 2, radiusY: 2 };
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint] });
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...touchPoint, y: touchPoint.y + 48 }],
        });
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect.poll(async () => (await readNotebook(page)).pages[0]!.links![0]!.y).toBeGreaterThan(penPosition.y);
        const committed = (await readNotebook(page)).pages[0]!.links![0]!;
        currentBounds = (await handle.boundingBox())!;
        const cancelPoint = { ...touchPoint, x: currentBounds.x + 22, y: currentBounds.y + 22 };
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [cancelPoint] });
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...cancelPoint, x: cancelPoint.x + 30, y: cancelPoint.y + 30 }],
        });
        await expect.poll(async () => (await handle.boundingBox())!.x).toBeGreaterThan(currentBounds.x + 20);
        await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
        await expect.poll(async () => (await handle.boundingBox())!.x).toBeCloseTo(currentBounds.x, 0);
        expect((await readNotebook(page)).pages[0]!.links![0]).toEqual(committed);
        await expect(page.getByLabel("Handwriting canvas", { exact: true }).locator("[data-ink-stroke]")).toHaveCount(
            0,
        );
        await expect(page).toHaveURL(sourceUrl);
        await expect(page.getByText("Tap the paper to move this link.", { exact: true })).toHaveCount(0);
        await session.detach();
        await page.reload();
        expect((await readNotebook(page)).pages[0]!.links![0]).toEqual(committed);
    });
});

test.describe("production safeguards", () => {
    test("offers visible light ink on dark paper", async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        await openNotebookOptions(page);
        const color = page.getByRole("textbox", { name: "Paper color hex" });
        await color.fill("#171717");
        await color.press("Tab");
        await closeOptions(page);
        await selectInk(page, "White");
        await draw(page);
        await expect(
            page.getByLabel("Handwriting canvas", { exact: true }).locator("[data-ink-stroke]"),
        ).toHaveAttribute("fill", "#ffffff");
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        await page.reload();
        await expect(page.getByLabel("Handwriting canvas", { exact: true })).toBeVisible();
        expect((await readNotebook(page)).pages[0]!.strokes[0]!.color).toBe("#ffffff");
    });

    test("prevents a stale browser tab from overwriting saved ink and exports its local copy", async ({
        cleanPage: page,
        context,
    }) => {
        await createHandwrittenNote(page);
        const second = await context.newPage();
        await second.goto(page.url(), { waitUntil: "domcontentloaded" });
        await expect(second.getByLabel("Handwriting canvas", { exact: true })).toBeVisible();
        await draw(page);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        const savedInk = (await readNotebook(page)).pages[0]!.strokes;
        await draw(second, 280);
        await expect(second.locator(".wm-save-state output")).toHaveText("Could not save");
        await expect(second.getByRole("alert")).toContainText("changed in another editor");
        expect((await readNotebook(second)).pages[0]!.strokes).toEqual(savedInk);
        await second.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(second.locator(".wm-save-state output")).toHaveText("Could not save");
        const download = second.waitForEvent("download");
        await second.getByRole("button", { name: "Download local copy", exact: true }).click();
        const localCopy = await download;
        expect(localCopy.suggestedFilename()).toMatch(/\.md$/);
        const { parseFreehandNote } = await import("../../packages/editor/src/lib/freehand-note");
        const recovered = parseFreehandNote(await readFile((await localCopy.path())!, "utf8"));
        expect(recovered.pages[0]!.strokes).toHaveLength(1);
        expect(recovered.pages[0]!.strokes).not.toEqual(savedInk);
        await second.close();
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByLabel("Handwriting canvas", { exact: true })).toBeVisible();
        expect((await readNotebook(page)).pages[0]!.strokes).toEqual(savedInk);
    });

    test("waits for pending ink to save before leaving the notebook", async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        const url = page.url();
        await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            const original = repositories.notes.updateContentIfUnchanged;
            repositories.notes.updateContentIfUnchanged = async (...args) => {
                await new Promise<void>((resolve) =>
                    window.addEventListener("release-notebook-save", () => resolve(), { once: true }),
                );
                return original.apply(repositories.notes, args);
            };
        });
        await draw(page);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saving…");
        await navigateHome(page);
        await expect(page).toHaveURL(url);
        await expect(page.getByRole("dialog", { name: "Unsaved notebook" })).toBeVisible();
        await page.evaluate(() => window.dispatchEvent(new Event("release-notebook-save")));
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page.goto(url);
        await expect(page.getByLabel("Handwriting canvas", { exact: true }).locator("[data-ink-stroke]")).toHaveCount(
            1,
        );
    });

    test("preserves notebook extension fields when saving ink", async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            const { buildFreehandNoteContent, emptyFreehandNotebook } =
                await import("/packages/editor/src/lib/freehand-note.ts");
            const data = {
                ...emptyFreehandNotebook(),
                extension: { author: "Keep this" },
                pages: [{ strokes: [], label: "Lecture" }],
            };
            await repositories.notes.updateContent(
                location.pathname.split("/").at(-1)!,
                buildFreehandNoteContent(data),
            );
        });
        await page.reload();
        await expect(page.getByLabel("Handwriting canvas", { exact: true })).toBeVisible();
        await draw(page);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        const raw = await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            return (await repositories.notes.getOne(location.pathname.split("/").at(-1)!))!.content;
        });
        expect(raw).toContain('"author":"Keep this"');
        expect(raw).toContain('"label":"Lecture"');
    });
});

test("customizes paper colors and background details across pages and reloads", async ({
    cleanPage: page,
}, testInfo) => {
    await createHandwrittenNote(page);
    await draw(page);
    await expect.poll(async () => (await readNotebook(page)).pages[0]?.strokes.length).toBe(1);
    const originalInk = (await readNotebook(page)).pages[0]!.strokes;
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const inkPath = await canvas.locator("[data-ink-stroke]").getAttribute("d");
    await openNotebookOptions(page);
    const paperColor = page.getByRole("textbox", { name: "Paper color hex", exact: true });
    const patternColor = page.getByRole("textbox", { name: "Pattern color hex", exact: true });
    await expect(paperColor).toHaveValue("#ffffff");
    await expect(patternColor).toHaveValue("#d7deea");
    await expect(page.getByRole("combobox", { name: "Pattern spacing" })).toHaveValue("32");
    await expect(page.getByRole("combobox", { name: "Pattern weight" })).toHaveValue("1");
    await paperColor.fill("#f7efdc");
    await paperColor.press("Tab");
    await patternColor.fill("#a68c70");
    await patternColor.press("Tab");
    await page.getByRole("combobox", { name: "Paper style" }).selectOption("grid");
    await page.getByRole("combobox", { name: "Pattern spacing" }).selectOption("48");
    await page.getByRole("combobox", { name: "Pattern weight" }).selectOption("2");
    await expect(canvas).toHaveCSS("background-color", "rgb(247, 239, 220)");
    await expect(canvas.locator("pattern")).toHaveAttribute("width", "48");
    await expect(canvas.locator(".wm-paper-rule")).toHaveCSS("stroke", "rgb(166, 140, 112)");
    await expect(canvas.locator(".wm-paper-rule")).toHaveCSS("stroke-width", "2px");
    await paperColor.fill("#oops");
    await paperColor.press("Tab");
    await expect(paperColor).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toHaveText("Use a hex color, such as #ffffff.");
    await expect(canvas).toHaveCSS("background-color", "rgb(247, 239, 220)");
    await paperColor.fill("#f7efdc");
    await paperColor.press("Tab");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await closeOptions(page);
    await expect(canvas.locator("[data-ink-stroke]")).toHaveAttribute("d", inkPath!);
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    const configured = { background: "#f7efdc", color: "#a68c70", spacing: 48, weight: 2 };
    expect((await readNotebook(page)).appearance).toEqual(configured);
    expect((await readNotebook(page)).pages[0]!.strokes).toEqual(originalInk);
    await page.screenshot({ path: testInfo.outputPath("paper-grid.png") });
    await page.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect(canvas.locator(".wm-paper-rule")).toHaveCSS("stroke-width", "1px");
    await page.getByRole("button", { name: "Redo drawing", exact: true }).click();
    await expect(canvas.locator(".wm-paper-rule")).toHaveCSS("stroke-width", "2px");
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(0);
    await expect(canvas).toHaveCSS("background-color", "rgb(247, 239, 220)");
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    await page.reload();
    await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
    expect((await readNotebook(page)).appearance).toEqual(configured);
    await setPaperStyle(page, "dotted");
    await expect(canvas.locator(".wm-paper-dot")).toHaveAttribute("r", "3");
    await expect(canvas.locator(".wm-paper-dot")).toHaveAttribute("cx", "24");
    await expect(canvas.locator(".wm-paper-dot")).toHaveCSS("fill", "rgb(166, 140, 112)");
    await setPaperStyle(page, "blank");
    await expect(canvas.locator("rect")).toHaveCount(0);
    await openNotebookOptions(page);
    await expect(patternColor).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Pattern spacing" })).toBeDisabled();
    await expect(paperColor).toBeEnabled();
    await page.getByRole("combobox", { name: "Paper style" }).selectOption("dotted");
    for (const [width, height] of [
        [375, 812],
        [812, 375],
    ]) {
        await page.setViewportSize({ width: width!, height: height! });
        await expectFloatingCanvas(page);
        for (const control of [
            paperColor,
            patternColor,
            page.getByLabel("Choose paper color", { exact: true }),
            page.getByRole("combobox", { name: "Pattern spacing" }),
            page.getByRole("combobox", { name: "Pattern weight" }),
        ]) {
            await control.focus();
            await expect(control).toBeInViewport();
            const bounds = await control.boundingBox();
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
            expect(bounds!.width).toBeGreaterThanOrEqual(44);
            await expect
                .poll(() =>
                    control.evaluate((element) => {
                        const bounds = element.getBoundingClientRect();
                        return element.contains(
                            document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
                        );
                    }),
                )
                .toBe(true);
        }
        await page.screenshot({ path: testInfo.outputPath(`paper-options-${width}.png`) });
    }
    await page.getByRole("button", { name: "Reset paper appearance", exact: true }).click();
    await expect(paperColor).toHaveValue("#ffffff");
    await expect(patternColor).toHaveValue("#d7deea");
    await expect(page.getByRole("combobox", { name: "Pattern spacing" })).toHaveValue("32");
    await expect(page.getByRole("combobox", { name: "Pattern weight" })).toHaveValue("1");
    await closeOptions(page);
    await page.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect(canvas).toHaveCSS("background-color", "rgb(247, 239, 220)");
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    await page.reload();
    await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
    expect((await readNotebook(page)).appearance).toEqual(configured);
    expect((await readNotebook(page)).pages[0]!.strokes).toEqual(originalInk);
});

test("reveals secondary options without drawing ink and restores keyboard focus", async ({
    cleanPage: page,
}, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await createHandwrittenNote(page);
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const strokes = canvas.locator("[data-ink-stroke]");
    const notebookTrigger = page.getByRole("button", { name: "Notebook options", exact: true });
    const inkTrigger = page.getByRole("button", { name: "Ink options", exact: true });
    await expect(page.getByRole("dialog", { name: /^(Ink|Notebook) options$/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Paper style" })).toHaveCount(0);
    await notebookTrigger.focus();
    await notebookTrigger.press("Enter");
    await expect(notebookTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("combobox", { name: "Paper style" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Notebook options", exact: true })).toHaveCount(0);
    await expect(notebookTrigger).toBeFocused();

    await inkTrigger.focus();
    await inkTrigger.press("Enter");
    await expect(page.getByRole("button", { name: "Graphite ink", exact: true })).toBeFocused();
    await page.getByRole("combobox", { name: "Stroke width" }).selectOption("8");
    await page.keyboard.press("Escape");
    await expect(inkTrigger).toBeFocused();
    await selectInk(page, "Blue");
    await expect(inkTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(strokes).toHaveCount(0);

    await openNotebookOptions(page);
    await draw(page);
    await expect(page.getByRole("dialog", { name: "Notebook options", exact: true })).toHaveCount(0);
    await expect(strokes).toHaveCount(1);
    await expect(strokes).toHaveAttribute("fill", "#2459c4");
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    const content = await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/global.store.ts");
        return (await repositories.notes.getOne(location.pathname.split("/").at(-1)!))?.content;
    });
    expect(content).toContain('"size":8');
    expect(
        await page
            .getByRole("button", { name: "Pen", exact: true })
            .evaluate((element) => getComputedStyle(element).transitionProperty),
    ).toBe("none");

    for (const [width, height] of [
        [375, 812],
        [812, 375],
    ]) {
        await page.setViewportSize({ width: width!, height: height! });
        await expectFloatingCanvas(page);
        await openNotebookOptions(page);
        const hideTools = page.getByRole("button", { name: "Hide writing tools" });
        await hideTools.focus();
        await expect(hideTools).toBeInViewport();
        expect(
            await hideTools.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return element.contains(
                    document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
                );
            }),
        ).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`minimal-options-${width}.png`) });
        await page.keyboard.press("Escape");
        await expect(notebookTrigger).toBeFocused();
    }
});

test("fills the workspace and keeps floating tools stationary while panning", async ({ cleanPage: page }, testInfo) => {
    await createHandwrittenNote(page);
    await expectFloatingCanvas(page);
    await expect
        .poll(async () => (await page.getByRole("region", { name: "Handwritten notebook" }).boundingBox())?.width ?? 0)
        .toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 1280) - 64);
    await setPaperStyle(page, "grid");
    await selectInk(page, "Blue");
    await draw(page);
    await page.getByRole("button", { name: "Highlighter", exact: true }).click();
    await draw(page, 270);
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const strokes = canvas.locator("[data-ink-stroke]");
    await expect(strokes).toHaveCount(2);
    await page.getByRole("button", { name: "Pen", exact: true }).click();
    await openNotebookOptions(page);
    await page.getByRole("button", { name: "Add to favorites" }).click();
    await expect(page.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute("aria-pressed", "true");
    await closeOptions(page);
    await expect(strokes).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("floating-canvas-desktop.png") });

    const toolbar = page.getByRole("toolbar", { name: "Writing tools" });
    const before = await toolbar.boundingBox();
    await clickNotebookTool(page, "Zoom in");
    await clickNotebookTool(page, "Move page");
    const viewport = await page.locator(".wm-paper-viewport").boundingBox();
    if (!viewport) throw new Error("Canvas viewport not visible");
    await page.mouse.move(viewport.x + 80, viewport.y + 320);
    await page.mouse.down();
    await page.mouse.move(viewport.x + 80, viewport.y + 220, { steps: 10 });
    await page.mouse.up();
    expect(await page.locator(".wm-paper-viewport").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await toolbar.boundingBox()).toEqual(before);
    await expect(strokes).toHaveCount(2);
    await clickNotebookTool(page, "Hide writing tools");
    await expect(toolbar).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show writing tools" })).toBeFocused();
    await page.getByRole("button", { name: "Show writing tools" }).click();
    await expect(page.getByRole("button", { name: "Notebook options", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Reset zoom" }).click();
    await expectFloatingCanvas(page);
});

test("creates and saves handwriting, erases actual strokes, and supports undo/redo and pages", async ({
    cleanPage: page,
}, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await createHandwrittenNote(page);
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const strokes = canvas.locator("[data-ink-stroke]");
    await draw(page);
    await expect(strokes).toHaveCount(1);
    const path = await strokes.first().getAttribute("d");
    await page.getByRole("button", { name: "Highlighter", exact: true }).click();
    await draw(page, 280);
    await expect(strokes).toHaveCount(2);
    await expect(canvas.locator('[data-ink-stroke="highlighter"]')).toHaveAttribute("opacity", "0.35");
    await page.getByRole("button", { name: "Eraser", exact: true }).click();
    await draw(page);
    await expect(strokes).toHaveCount(1);
    await page.getByRole("button", { name: "Undo drawing" }).click();
    await expect(strokes).toHaveCount(2);
    await page.getByRole("button", { name: "Redo drawing" }).click();
    await expect(strokes).toHaveCount(1);
    await page.getByRole("button", { name: "Undo drawing" }).click();
    await setPaperStyle(page, "grid");
    await page.getByRole("button", { name: "Add page" }).click();
    await expect(strokes).toHaveCount(0);
    await selectInk(page, "Blue");
    await draw(page);
    await expect(strokes).toHaveAttribute("fill", "#2459c4");
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    await page.reload();
    await openNotebookOptions(page);
    await expect(page.getByRole("combobox", { name: "Paper style" })).toHaveValue("grid");
    await closeOptions(page);
    await expect(strokes).toHaveCount(2);
    await expect(strokes.first()).toHaveAttribute("d", path!);
    await clickNotebookTool(page, "Zoom in");
    await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("115%");
    await expect(strokes.first()).toHaveAttribute("d", path!);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(strokes).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("handwritten-desktop.png") });
    expect(errors).toEqual([]);
});

test.describe("tablet handwriting", () => {
    test.use({ hasTouch: true });

    test("moves the page with fingers, pinches to zoom and discards canceled ink @chromium-input", async ({
        cleanPage: page,
    }) => {
        await createHandwrittenNote(page);
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        const bounds = await canvas.boundingBox();
        if (!bounds) throw new Error("Canvas not visible");
        const session = await page.context().newCDPSession(page);
        const first = { x: bounds.x + 100, y: bounds.y + 220, id: 1 };
        const second = { x: bounds.x + 200, y: bounds.y + 220, id: 2 };
        await clickNotebookTool(page, "Zoom in");
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...first, y: first.y - 80 }],
        });
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        expect(await page.locator(".wm-paper-viewport").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(0);
        await page.getByRole("button", { name: "Reset zoom" }).click();
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [first, { ...second, x: second.x + 100 }],
        });
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("200%");
        await page.getByRole("button", { name: "Reset zoom" }).click();
        await enableTouchDrawing(page);
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...first, x: first.x + 40 }],
        });
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
        await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(0);
        await page.touchscreen.tap(first.x, first.y);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
        await session.detach();
    });

    test("uses pen pressure and rejects fingers while writing @chromium-input", async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        const bounds = await canvas.boundingBox();
        if (!bounds) throw new Error("Canvas not visible");
        const session = await page.context().newCDPSession(page);
        const x = bounds.x + 100;
        const y = bounds.y + 220;
        await session.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x,
            y,
            button: "left",
            buttons: 1,
            clickCount: 1,
            pointerType: "pen",
            force: 0.2,
        });
        await canvas.dispatchEvent("pointerdown", {
            pointerId: 55,
            pointerType: "touch",
            clientX: x + 50,
            clientY: y + 50,
            width: 60,
            height: 60,
        });
        await session.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: x + 100,
            y: y + 20,
            button: "left",
            buttons: 1,
            pointerType: "pen",
            force: 0.8,
        });
        await session.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: x + 100,
            y: y + 20,
            button: "left",
            buttons: 0,
            clickCount: 1,
            pointerType: "pen",
        });
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        const content = await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            const note = await repositories.notes.getOne(location.pathname.split("/").at(-1)!);
            return note?.content ?? "";
        });
        expect(content).toContain("0.2");
        expect(content).toContain("0.8");
        expect(content).toContain('"simulatePressure":false');
        await page.touchscreen.tap(x + 150, y + 80);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
        await enableTouchDrawing(page);
        await page.touchscreen.tap(x + 150, y + 80);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(2);
        await session.detach();
    });

    test("draws by touch only when enabled and saves finger ink", async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        const bounds = await canvas.boundingBox();
        if (!bounds) throw new Error("Canvas not visible");
        await page.touchscreen.tap(bounds.x + 100, bounds.y + 220);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(0);
        await enableTouchDrawing(page);
        await page.touchscreen.tap(bounds.x + 100, bounds.y + 220);
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        await page.reload();
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
    });

    for (const theme of ["dark", "light"]) {
        test(`keeps writing tools accessible in tablet portrait, landscape and narrow layouts (${theme})`, async ({
            cleanPage: page,
        }, testInfo) => {
            await page.goto("/settings/appearance");
            await closeWorkspaceMenu(page);
            await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
            await page.getByRole("button", { name: "Save Appearance" }).click();
            await createHandwrittenNote(page);
            const notebook = page.getByRole("region", { name: "Handwritten notebook" });
            for (const [width, height] of [
                [820, 1180],
                [1180, 820],
                [375, 812],
            ]) {
                await page.setViewportSize({ width: width!, height: height! });
                await expect(notebook).toBeVisible();
                await expectFloatingCanvas(page);
                await notebook.getByRole("button", { name: "Pen", exact: true }).click();
                await expect(notebook.getByRole("button", { name: "Pen", exact: true })).toHaveAttribute(
                    "aria-pressed",
                    "true",
                );
                expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width!);
                const controls = notebook.locator("button, select");
                for (const control of await controls.all()) {
                    const bounds = await control.boundingBox();
                    if (!bounds) throw new Error("Missing canvas control");
                    expect(bounds.height).toBeGreaterThanOrEqual(44);
                    expect(bounds.width).toBeGreaterThanOrEqual(44);
                    expect(bounds.x).toBeGreaterThanOrEqual(0);
                    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width!);
                    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height!);
                }
                await page.screenshot({ path: testInfo.outputPath(`handwritten-${theme}-${width}.png`) });
            }
        });
    }
});

test("keeps ink after a save failure and retries it", async ({ cleanPage: page }) => {
    await createHandwrittenNote(page);
    await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/global.store.ts");
        const original = repositories.notes.updateContentIfUnchanged;
        repositories.notes.updateContentIfUnchanged = async () => {
            throw new Error("Storage unavailable");
        };
        window.addEventListener(
            "restore-note-storage",
            () => {
                repositories.notes.updateContentIfUnchanged = original;
            },
            { once: true },
        );
    });
    await draw(page);
    await expect(page.locator(".wm-save-state output")).toHaveText("Could not save");
    await expect(page.getByLabel("Handwriting canvas", { exact: true }).locator("[data-ink-stroke]")).toHaveCount(1);
    await page.evaluate(() => window.dispatchEvent(new Event("restore-note-storage")));
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByLabel("Handwriting canvas", { exact: true }).locator("[data-ink-stroke]")).toHaveCount(1);
});

for (const [name, payload] of [
    ["malformed", "broken handwriting payload"],
    ["unsafe coordinates", JSON.stringify({ strokes: [{ points: [[1e300, 1e300, 0.5]], color: "#000000", size: 4 }] })],
    ["unsupported version", JSON.stringify({ version: 2, paper: "lined", pages: [{ strokes: [] }], strokes: [] })],
] as const)
    test(`keeps ${name} note content intact`, async ({ cleanPage: page }) => {
        await createHandwrittenNote(page);
        await page.evaluate(async (content) => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            await repositories.notes.updateContent(location.pathname.split("/").at(-1)!, content);
        }, payload);
        await page.reload();
        await expect(page.getByRole("alert")).toContainText("original content has been kept");
        await expect(page.getByLabel("Handwriting canvas", { exact: true })).toHaveCount(0);
        const content = await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            return (await repositories.notes.getOne(location.pathname.split("/").at(-1)!))?.content;
        });
        expect(content).toBe(payload);
    });

for (const span of [400, 1e12])
    test(`opens legacy ink, erases a sparse stroke of length ${span} and preserves surrounding metadata`, async ({
        cleanPage: page,
    }) => {
        await createHandwrittenNote(page);
        await page.evaluate(async (end) => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            const data = {
                strokes: [
                    {
                        points: [
                            [50, 50, 0.5],
                            [end, 50, 0.5],
                        ],
                        color: "#000000",
                        size: 8,
                    },
                    {
                        points: [
                            [50, 250, 0.5],
                            [400, 250, 0.5],
                        ],
                        color: "#2459c4",
                        size: 8,
                    },
                ],
            };
            const content = `---\ntype: freehand\ncustom: keep-me\n---\n\n\`\`\`freehand\n${JSON.stringify(data)}\n\`\`\`\n\nPersonal metadata\n`;
            await repositories.notes.updateContent(location.pathname.split("/").at(-1)!, content);
        }, span);
        await page.reload();
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        const strokes = canvas.locator("[data-ink-stroke]");
        await expect(strokes).toHaveCount(2);
        await openNotebookOptions(page);
        await expect(page.getByRole("combobox", { name: "Paper style" })).toHaveValue("blank");
        await expect(page.getByRole("textbox", { name: "Paper color hex" })).toHaveValue("#ffffff");
        await expect(page.getByRole("combobox", { name: "Pattern spacing" })).toHaveValue("32");
        await closeOptions(page);
        const untouchedPath = await strokes.nth(1).getAttribute("d");
        await page.getByRole("button", { name: "Eraser", exact: true }).click();
        await clickNotebookTool(page, "Hide writing tools");
        const bounds = await canvas.boundingBox();
        if (!bounds) throw new Error("Canvas not visible");
        const scale = bounds.width / 1000;
        await page.mouse.move(bounds.x + 225 * scale, bounds.y + 20 * scale);
        await page.mouse.down();
        await page.mouse.move(bounds.x + 225 * scale, bounds.y + 80 * scale);
        await page.mouse.up();
        await expect(strokes).toHaveCount(1);
        await expect(strokes.first()).toHaveAttribute("d", untouchedPath!);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        await page.reload();
        await expect(strokes).toHaveCount(1);
        const content = await page.evaluate(async () => {
            const { repositories } = await import("/packages/editor/src/store/global.store.ts");
            return (await repositories.notes.getOne(location.pathname.split("/").at(-1)!))?.content;
        });
        expect(content).toContain("custom: keep-me");
        expect(content).toContain("Personal metadata");
    });
