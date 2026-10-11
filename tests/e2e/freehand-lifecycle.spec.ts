import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { addInk, expectSavedNotebook, navigateHome, writeNotebook } from "../helpers/handwriting";

async function createLinkedNotebook(page: Page): Promise<string> {
    await page.goto("/");
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/ });
    await dialog.getByTitle("Note title").fill("Tablet reference");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
    const target = page.url();
    await navigateHome(page);
    await writeNotebook(page);
    await page.getByRole("button", { name: "Notebook options", exact: true }).click();
    await page.getByRole("button", { name: "Add note link", exact: true }).click();
    await page
        .getByRole("dialog", { name: "Link a note" })
        .getByRole("button", {
            name: "Tablet reference",
            exact: true,
        })
        .click();
    await expect(page.getByRole("group", { name: "Linked note: Tablet reference", exact: true })).toBeVisible();
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    return target;
}

test("retains pages, paper and sticky links after rotation and returning from another tab", async ({
    page,
    context,
}, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const target = await createLinkedNotebook(page);
    const source = page.url();
    const firstPath = await page.locator("[data-ink-stroke]").getAttribute("d");
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    await addInk(page, 280);
    const secondPath = await page.locator("[data-ink-stroke]").getAttribute("d");
    expect(secondPath).not.toBe(firstPath);
    const background = await context.newPage();
    await background.goto("about:blank");
    await background.bringToFront();
    await page.bringToFront();
    await background.close();
    for (const viewport of [
        { width: 820, height: 1180 },
        { width: 1180, height: 820 },
    ]) {
        await page.setViewportSize(viewport);
        await expectSavedNotebook(page);
        await expect(page.locator("[data-ink-stroke]")).toHaveAttribute("d", secondPath!);
        for (const control of await page.getByRole("toolbar", { name: "Writing tools" }).getByRole("button").all()) {
            const bounds = await control.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.width).toBeGreaterThanOrEqual(44);
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
            expect(bounds!.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
            expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
        }
        await page.screenshot({ path: testInfo.outputPath(`tablet-return-${viewport.width}.png`) });
    }
    await page.reload();
    await expectSavedNotebook(page);
    await expect(page.locator("[data-ink-stroke]")).toHaveAttribute("d", firstPath!);
    await page.getByRole("link", { name: "Open note: Tablet reference", exact: true }).click();
    await expect(page).toHaveURL(target);
    await page.goto(source);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.locator("[data-ink-stroke]")).toHaveAttribute("d", secondPath!);
    await expect(page.getByRole("group", { name: "Linked note: Tablet reference", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("retains the complete notebook after closing and restarting the browser", async ({
    playwright,
    browserName,
    baseURL,
}, testInfo) => {
    const profile = await mkdtemp(path.join(tmpdir(), "writeme-notebook-browser-"));
    await mkdir(testInfo.outputPath("restart-videos"), { recursive: true });
    const device = testInfo.project.use;
    const launch = (): ReturnType<typeof playwright.chromium.launchPersistentContext> =>
        playwright[browserName].launchPersistentContext(profile, {
            baseURL,
            viewport: device.viewport,
            hasTouch: device.hasTouch,
            isMobile: device.isMobile,
            deviceScaleFactor: device.deviceScaleFactor,
            userAgent: device.userAgent,
            recordVideo: { dir: testInfo.outputPath("restart-videos"), size: device.viewport ?? undefined },
        });
    let context: Awaited<ReturnType<typeof launch>> | undefined;
    try {
        context = await launch();
        const page = context.pages()[0] ?? (await context.newPage());
        const target = await createLinkedNotebook(page);
        const source = page.url();
        const firstPath = await page.locator("[data-ink-stroke]").getAttribute("d");
        await page.getByRole("button", { name: "Add page", exact: true }).click();
        await addInk(page, 280);
        const secondPath = await page.locator("[data-ink-stroke]").getAttribute("d");
        await context.close();
        context = undefined;
        context = await launch();
        const reopened = context.pages()[0] ?? (await context.newPage());
        await reopened.goto(source);
        await expectSavedNotebook(reopened);
        await expect(reopened.locator("[data-ink-stroke]")).toHaveAttribute("d", firstPath!);
        await reopened.getByRole("button", { name: "Next page", exact: true }).click();
        await expectSavedNotebook(reopened);
        await expect(reopened.locator("[data-ink-stroke]")).toHaveAttribute("d", secondPath!);
        await reopened.getByRole("button", { name: "Previous page", exact: true }).click();
        await reopened.getByRole("link", { name: "Open note: Tablet reference", exact: true }).click();
        await expect(reopened).toHaveURL(target);
        await expect(reopened.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
    } finally {
        try {
            await context?.close();
        } finally {
            await rm(profile, { recursive: true, force: true });
        }
        for (const filename of await readdir(testInfo.outputPath("restart-videos"))) {
            if (filename.endsWith(".webm"))
                await testInfo.attach("Browser restart session", {
                    path: testInfo.outputPath("restart-videos", filename),
                    contentType: "video/webm",
                });
        }
    }
});

test("recovers pen input after pointer capture is lost @chromium-input", async ({ page, context }) => {
    await page.goto("/");
    await writeNotebook(page);
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    await canvas.evaluate((element) =>
        element.addEventListener(
            "pointerdown",
            (event) => {
                if (event instanceof PointerEvent) element.setAttribute("data-test-pointer", String(event.pointerId));
            },
            { once: true },
        ),
    );
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Canvas is not visible");
    const session = await context.newCDPSession(page);
    const position = { x: bounds.x + 100, y: bounds.y + 300, pointerType: "pen", button: "left" } satisfies {
        x: number;
        y: number;
        pointerType: "pen";
        button: "left";
    };
    try {
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            type: "mousePressed",
            buttons: 1,
            clickCount: 1,
            force: 0.2,
        });
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            x: position.x + 50,
            type: "mouseMoved",
            buttons: 1,
            force: 0.8,
        });
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(2);
        await canvas.evaluate((element) =>
            element.releasePointerCapture(Number(element.getAttribute("data-test-pointer"))),
        );
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            x: position.x + 60,
            type: "mouseMoved",
            buttons: 1,
            force: 0.8,
        });
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(1);
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            type: "mouseReleased",
            buttons: 0,
            clickCount: 1,
        });
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            type: "mousePressed",
            buttons: 1,
            clickCount: 1,
            force: 0.2,
        });
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            x: position.x + 100,
            type: "mouseMoved",
            buttons: 1,
            force: 0.8,
        });
        await session.send("Input.dispatchMouseEvent", {
            ...position,
            x: position.x + 100,
            type: "mouseReleased",
            buttons: 0,
            clickCount: 1,
        });
        await expect(canvas.locator("[data-ink-stroke]")).toHaveCount(2);
        await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
        const paths = await canvas
            .locator("[data-ink-stroke]")
            .evaluateAll((elements) => elements.map((element) => element.getAttribute("d")));
        await page.reload();
        await expectSavedNotebook(page, 2);
        expect(
            await canvas
                .locator("[data-ink-stroke]")
                .evaluateAll((elements) => elements.map((element) => element.getAttribute("d"))),
        ).toEqual(paths);
    } finally {
        await session.detach();
    }
});
