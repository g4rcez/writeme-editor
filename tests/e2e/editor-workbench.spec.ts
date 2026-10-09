import { createNote, expect, goHome, test } from "./fixtures";

const endOfDocument = process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End";

test.describe("editor workbench", () => {
    test("keeps documents in independent, resizable editor groups", async ({ cleanPage: page }, testInfo) => {
        await goHome(page);
        const referenceUrl = await createNote(page, "Reference document", "Reference text stays in its own editor.");
        await goHome(page);
        const workingUrl = await createNote(page, "Working document", "Working text stays in its own editor.");
        await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
        await page.getByRole("button", { name: "Open pane mode", exact: true }).click();

        const first = page.getByRole("region", { name: "Editor group 1", exact: true });
        const second = page.getByRole("region", { name: "Editor group 2", exact: true });
        await expect(first.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("Working text");
        await expect(second.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("Reference text");
        await expect(first).toHaveAttribute("data-active", "true");
        await second.getByRole("textbox", { name: "Note editor", exact: true }).click();
        await expect(second).toHaveAttribute("data-active", "true");
        await expect(first).toHaveAttribute("data-active", "false");
        await expect(page).toHaveURL(workingUrl);

        const separator = page.getByRole("separator", { name: "Resize editor groups 1 and 2" });
        const initialWidth = await first.evaluate((element) => element.getBoundingClientRect().width);
        await separator.focus();
        await separator.press("ArrowRight");
        await expect
            .poll(() => first.evaluate((element) => element.getBoundingClientRect().width))
            .toBeGreaterThan(initialWidth);

        await first.getByRole("button", { name: "Editor group 1 actions" }).click();
        await page
            .getByRole("dialog", { name: "Editor group 1 actions" })
            .getByRole("button", { name: "Equal group sizes" })
            .click();
        await expect
            .poll(async () =>
                Math.abs(
                    (await first.evaluate((element) => element.getBoundingClientRect().width)) -
                        (await second.evaluate((element) => element.getBoundingClientRect().width)),
                ),
            )
            .toBeLessThanOrEqual(1);

        const equalWidth = await first.evaluate((element) => element.getBoundingClientRect().width);
        const divider = await separator.boundingBox();
        if (!divider) throw new Error("Expected a visible editor divider");
        await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2);
        await page.mouse.down();
        await page.mouse.move(divider.x + 48, divider.y + divider.height / 2);
        await page.mouse.up();
        await expect
            .poll(() => first.evaluate((element) => element.getBoundingClientRect().width))
            .toBeGreaterThan(equalWidth);

        const referenceId = referenceUrl.split("/").at(-1)!;
        await first.getByRole("combobox", { name: "Select note for pane 1" }).selectOption(referenceId);
        await expect(first.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("Reference text");

        await first.getByRole("button", { name: "Add editor pane" }).click();
        await expect(page.getByRole("region", { name: "Editor group 3", exact: true })).toBeVisible();
        await first.getByRole("button", { name: "Add editor pane" }).click();
        await expect(page.getByRole("region", { name: "Editor group 4", exact: true })).toBeVisible();
        for (const button of await page.getByRole("button", { name: "Add editor pane" }).all()) {
            await expect(button).toBeDisabled();
        }
        await page.getByRole("button", { name: "Close pane 4" }).click();
        await page.getByRole("button", { name: "Close pane 3" }).click();

        await page.emulateMedia({ reducedMotion: "reduce" });
        for (const width of [375, 768, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await expect
                .poll(async () => {
                    const a = await first.boundingBox();
                    const b = await second.boundingBox();
                    if (!a || !b) return false;
                    return width < 640 ? b.y > a.y && Math.abs(b.x - a.x) <= 1 : b.x > a.x;
                })
                .toBe(true);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            const footer = page.locator(".writeme-editor-status-bar");
            const groupBottom = await second.evaluate((element) => element.getBoundingClientRect().bottom);
            const footerTop = await footer.evaluate((element) => element.getBoundingClientRect().top);
            expect(groupBottom).toBeLessThanOrEqual(footerTop + 1);
            await page.screenshot({ path: testInfo.outputPath(`editor-groups-${width}.png`) });
        }

        await first.getByRole("button", { name: "Editor group 1 actions" }).click();
        await page
            .getByRole("dialog", { name: "Editor group 1 actions" })
            .getByRole("button", { name: "Single editor" })
            .click();
        await expect(page.getByRole("region", { name: "Editor groups" })).not.toBeVisible();
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("Working text");
    });

    for (const theme of ["dark", "light"] as const) {
        test(`keeps the last line above the footer while typing (${theme})`, async ({ cleanPage: page }, testInfo) => {
            await page.goto("/settings/appearance");
            await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
            await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
            await goHome(page);
            await createNote(page, "End of document");
            const editor = page.getByRole("textbox", { name: "Note editor", exact: true });

            for (const width of [375, 1280]) {
                await page.setViewportSize({ width, height: 900 });
                await editor.fill("A longer document keeps the final line below the first screen. ".repeat(90));
                await editor.press(endOfDocument);
                await editor.press("Enter");
                await editor.pressSequentially("unpredictable");
                await expect(editor.locator("p").last()).toHaveText("unpredictable");
                await expect
                    .poll(() =>
                        page.evaluate(() => {
                            const selection = window.getSelection();
                            const footer = document.querySelector(".writeme-editor-status-bar");
                            if (!selection?.rangeCount || !footer) return -1;
                            const range = selection.getRangeAt(0).cloneRange();
                            if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
                                range.setStart(range.startContainer, range.startOffset - 1);
                            }
                            const caret = range.getBoundingClientRect();
                            return caret.height > 0 ? footer.getBoundingClientRect().top - caret.bottom : -1;
                        }),
                    )
                    .toBeGreaterThanOrEqual(16);
                expect(
                    await page.locator("#main-scroll-container").evaluate((element) => element.scrollTop),
                ).toBeGreaterThan(0);
                await page.screenshot({ path: testInfo.outputPath(`editor-end-${theme}-${width}.png`) });
            }
        });
    }

    test("pastes a single word into empty text and code blocks", async ({ cleanPage: page, context }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await goHome(page);
        await createNote(page, "Plain text paste");
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await editor.fill("");
        await page.evaluate(() => navigator.clipboard.writeText("unpredictable"));
        await editor.press("ControlOrMeta+V");
        await expect(editor).toHaveText("unpredictable");

        await editor.press("ControlOrMeta+A");
        await editor.press("ControlOrMeta+V");
        await expect(editor).toHaveText("unpredictable");

        await editor.press("ControlOrMeta+A");
        await editor.press("Backspace");
        await editor.pressSequentially("```text");
        await editor.press("Space");
        const code = editor.locator(".cm-content[contenteditable=true]").first();
        await expect(code).toBeVisible();
        await code.click();
        await code.press("ControlOrMeta+V");
        await expect(code).toHaveText("unpredictable");
    });

    test("keeps nested list items tighter than top-level items", async ({ cleanPage: page, context }, testInfo) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await goHome(page);
        await createNote(page, "Grouped subitems");
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await editor.fill("");
        await page.evaluate(() =>
            navigator.clipboard.writeText(
                [
                    "1. First parent item",
                    "2. Second parent item",
                    "   1. First related child with enough detail to wrap at narrow widths without clipping text.",
                    "   2. Second related child",
                    "3. Next parent item",
                ].join("\n"),
            ),
        );
        await editor.press("ControlOrMeta+V");
        const nested = editor.locator("ol ol").first();
        await expect(nested).toBeVisible();
        await expect(nested.locator(":scope > li")).toHaveCount(2);

        for (const width of [375, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            const spacing = await nested.evaluate((list) => {
                const parent = list.parentElement?.querySelector(":scope > p");
                const child = list.querySelector("li > p");
                if (!parent || !child) throw new Error("Expected parent and child list paragraphs");
                const parentStyle = getComputedStyle(parent);
                const childStyle = getComputedStyle(child);
                const listStyle = getComputedStyle(list);
                return {
                    parentLineHeight: parseFloat(parentStyle.lineHeight),
                    childLineHeight: parseFloat(childStyle.lineHeight),
                    childFontSize: parseFloat(childStyle.fontSize),
                    top: parseFloat(listStyle.marginTop),
                    bottom: parseFloat(listStyle.marginBottom),
                };
            });
            expect(spacing.childLineHeight / spacing.childFontSize).toBeCloseTo(1.5, 1);
            expect(spacing.childLineHeight).toBeLessThan(spacing.parentLineHeight);
            expect(spacing.top).toBeLessThanOrEqual(4);
            expect(spacing.bottom).toBeLessThanOrEqual(4);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await editor.screenshot({ path: testInfo.outputPath(`editor-list-${width}.png`) });
        }
    });
});
