import { createNote, goHome, test, expect } from "./fixtures";

test.describe("note context layout", () => {
    test("switches between a desktop panel and a narrow-screen drawer", async ({ cleanPage: page }, testInfo) => {
        await goHome(page);
        await createNote(page, "Context layout note");

        for (const width of [375, 768, 960, 1280, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            const openButton = page.getByRole("button", { name: "Open note context" });
            await openButton.click();

            if (width <= 959) {
                const drawer = page.getByRole("dialog", { name: "Context" });
                await expect(drawer).toBeVisible();
                await expect
                    .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
                    .toBe(true);
                await page.keyboard.press("Shift+Tab");
                await expect
                    .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
                    .toBe(true);
                await page.keyboard.press("Tab");
                await expect
                    .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
                    .toBe(true);
                await expect
                    .poll(async () => {
                        const bounds = await drawer.boundingBox();
                        return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= width + 1;
                    })
                    .toBe(true);
            } else {
                const panel = page.getByRole("complementary", { name: "Context" });
                await expect(panel).toBeVisible();
                await expect(page.getByRole("dialog", { name: "Context" })).toHaveCount(0);
            }

            const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            expect(documentWidth).toBeLessThanOrEqual(width);
            await page.screenshot({ path: testInfo.outputPath(`empty-note-context-${width}.png`) });
            await page.keyboard.press("Escape");
            await expect(page.getByRole("button", { name: "Open note context" })).toHaveAttribute(
                "aria-pressed",
                "false",
            );
            await expect(openButton).toBeFocused();
        }

        await page.setViewportSize({ width: 375, height: 900 });
        const closeWorkspaceMenu = page.getByRole("button", { name: "Close workspace menu" });
        if ((await closeWorkspaceMenu.count()) === 0) {
            await page.getByRole("button", { name: "Open workspace menu" }).click();
        }
        await expect(closeWorkspaceMenu).toBeVisible();
        await page.getByRole("button", { name: "Open note context" }).click();
        await expect(page.getByRole("dialog", { name: "Context" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Open workspace menu" })).toBeVisible();
    });

    for (const theme of ["dark", "light"] as const) {
        test(`keeps note toolbar groups within the viewport (${theme})`, async ({ cleanPage: page }, testInfo) => {
            await page.goto("/settings/appearance");
            await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
            await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
            await page.getByRole("button", { name: "Save Appearance" }).click();
            await goHome(page);
            await createNote(page, "Toolbar layout note", "## Toolbar section");

            const title = page.getByRole("textbox", { name: "Note title" });
            const toolbar = page.getByRole("toolbar", { name: "Note tools" });
            const modeGroup = page.getByRole("group", { name: "Editor mode" });
            const actionsGroup = page.getByRole("group", { name: "Note actions" });

            for (const width of [375, 640, 768, 1280]) {
                await page.setViewportSize({ width, height: 900 });
                for (const mode of ["Formatted", "Markdown"]) {
                    const modeButton = modeGroup.getByRole("button", { name: mode });
                    await modeButton.click();
                    await expect(modeButton).toHaveAttribute("aria-pressed", "true");
                    await expect(toolbar).toBeVisible();
                    await expect(actionsGroup).toBeVisible();
                    if (mode === "Formatted") {
                        await expect(
                            actionsGroup.getByRole("button", { name: "Open table of contents" }),
                        ).toBeVisible();
                    } else {
                        const vimMode = toolbar.getByRole("checkbox", { name: "Vim mode" });
                        await expect(vimMode).toBeVisible();
                        expect(await vimMode.evaluate((element) => element.closest("button") === null)).toBe(true);
                    }

                    const titleBounds = await title.boundingBox();
                    const toolbarBounds = await toolbar.boundingBox();
                    const editorBounds = await page.locator(".writeme-editor").first().boundingBox();
                    const modeBounds = await modeGroup.boundingBox();
                    const actionsBounds = await actionsGroup.boundingBox();
                    const filename = toolbar.locator(".writeme-note-toolbar-file-name");
                    const filenameBounds = await filename.boundingBox();
                    if (
                        !titleBounds ||
                        !toolbarBounds ||
                        !editorBounds ||
                        !modeBounds ||
                        !actionsBounds ||
                        !filenameBounds
                    ) {
                        throw new Error("Expected visible note header bounds");
                    }

                    await expect(filename).toHaveText("Toolbar layout note");
                    expect(toolbarBounds.y + toolbarBounds.height).toBeLessThanOrEqual(titleBounds.y);
                    expect(toolbarBounds.x).toBeCloseTo(editorBounds.x, 0);
                    expect(toolbarBounds.width).toBeCloseTo(editorBounds.width, 0);
                    if (toolbarBounds.width > 672) expect(toolbarBounds.height).toBeLessThanOrEqual(40);
                    expect(
                        Math.abs(
                            filenameBounds.x + filenameBounds.width / 2 - (toolbarBounds.x + toolbarBounds.width / 2),
                        ),
                    ).toBeLessThanOrEqual(2);
                    expect(actionsBounds.x).toBeGreaterThanOrEqual(toolbarBounds.x - 1);
                    expect(actionsBounds.x + actionsBounds.width).toBeLessThanOrEqual(
                        toolbarBounds.x + toolbarBounds.width + 1,
                    );
                    if (toolbarBounds.width <= 672) {
                        expect(actionsBounds.y).toBeGreaterThanOrEqual(modeBounds.y + modeBounds.height);
                    }

                    const buttons = actionsGroup.getByRole("button");
                    expect(await buttons.count()).toBeGreaterThanOrEqual(4);
                    for (const button of await buttons.all()) {
                        await expect(button).toHaveAttribute("data-component", "button");
                        await expect(button).toHaveClass(/__button--theme-ghost-muted/);
                        const bounds = await button.boundingBox();
                        if (!bounds) throw new Error("Expected visible utility button bounds");
                        expect(bounds.width).toBeGreaterThanOrEqual(width <= 640 ? 44 : 32);
                        expect(bounds.height).toBeGreaterThanOrEqual(width <= 640 ? 44 : 32);
                        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
                    }
                    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
                    if (width === 375 || width === 1280) {
                        await page.locator(".writeme-editor-page").screenshot({
                            path: testInfo.outputPath(`note-toolbar-${theme}-${mode}-${width}.png`),
                        });
                    }
                    if (mode === "Formatted") {
                        const contentsButton = actionsGroup.getByRole("button", { name: "Open table of contents" });
                        await contentsButton.click();
                        await expect(contentsButton).toHaveAttribute("aria-expanded", "true");
                        const contents = page.getByRole("dialog", { name: "Table of contents" });
                        await expect(contents).toBeVisible();
                        const bounds = await contents.boundingBox();
                        if (!bounds) throw new Error("Expected visible table-of-contents bounds");
                        expect(bounds.x).toBeGreaterThanOrEqual(0);
                        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
                        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
                            width,
                        );
                        await contents.getByRole("button", { name: "Close table of contents" }).click();
                        await expect(contents).not.toBeVisible();
                    }
                }
            }
        });
    }

    test("captures a long note with the sidebar collapsed", async ({ cleanPage: page }, testInfo) => {
        await goHome(page);
        const content = Array.from(
            { length: 8 },
            (_, index) =>
                `Paragraph ${index + 1}. This longer note helps review line wrapping, reading width, and context-panel balance across the responsive layout. ` +
                "It includes enough text to continue below the first screen without relying on placeholder content.",
        ).join(" ");
        await createNote(page, "An intentionally long note title for responsive layout review", content);
        await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();

        for (const width of [375, 640, 768, 960, 1280, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            const openButton = page.getByRole("button", { name: "Open note context" });
            await openButton.click();
            const context =
                width <= 959
                    ? page.getByRole("dialog", { name: "Context" })
                    : page.getByRole("complementary", { name: "Context" });
            await expect(context).toBeVisible();
            if (width <= 959) {
                await expect
                    .poll(async () => {
                        const bounds = await context.boundingBox();
                        return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= width + 1;
                    })
                    .toBe(true);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await page.screenshot({ path: testInfo.outputPath(`long-note-context-${width}.png`) });
            await page.keyboard.press("Escape");
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.keyboard.press("Control+Shift+P");
        await page.getByText("New Terminal", { exact: true }).click();
        await expect(page).toHaveURL(/\/terminal\/[^/]+$/);
        await expect(page.getByRole("group", { name: "Terminal" }).first()).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath("terminal-tab-1280.png") });
    });

    test("captures a terminal at a mobile viewport", async ({ cleanPage: page }, testInfo) => {
        await page.setViewportSize({ width: 375, height: 900 });
        await goHome(page);
        await page.keyboard.press("Control+Shift+P");
        await page.getByText("New Terminal", { exact: true }).click();
        await expect(page).toHaveURL(/\/terminal\/[^/]+$/);
        await expect(page.getByText("New Terminal", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("group", { name: "Terminal" }).first()).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath("terminal-tab-375.png") });
    });

    test("runs Bash commands in the browser's virtual workspace", async ({ cleanPage: page }) => {
        await goHome(page);
        await page.keyboard.press("Control+Shift+P");
        await page.getByText("New Terminal", { exact: true }).click();
        await expect(page).toHaveURL(/\/terminal\/[^/]+$/);

        const terminal = page.getByRole("group", { name: "Terminal" }).first();
        const input = page.getByRole("textbox", { name: "Terminal" }).first();
        await expect(terminal).toBeVisible();
        await input.focus();
        await input.pressSequentially("echo WritemeBashReady");
        await input.press("Enter");
        await expect(terminal).toContainText("WritemeBashReady");

        await input.pressSequentially("pwd");
        await input.press("Enter");
        await expect(terminal).toContainText("/workspace");

        await input.pressSequentially("list-notes");
        await input.press("Enter");
        await expect(terminal).toContainText("Found");
    });
});
