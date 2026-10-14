import type { Locator, Page } from "@playwright/test";
import { createNote, expect, goHome, test } from "./fixtures";

const menu = (page: Page): Locator => page.getByRole("menu", { name: "Block actions", exact: true });
const editor = (page: Page): Locator => page.getByRole("textbox", { name: "Note editor", exact: true });

async function seed(page: Page, html: string): Promise<void> {
    await editor(page).click();
    await page.evaluate(async (content) => {
        const path = "/packages/editor/src/app/editor-global-ref.tsx";
        const { editorGlobalRef } = await import(path);
        if (!editorGlobalRef.current) throw new Error("Note editor was not activated");
        editorGlobalRef.current.commands.setContent(content);
    }, html);
}

async function openFor(page: Page, block: Locator): Promise<void> {
    await block.click();
    await page.keyboard.press("Alt+Shift+m");
    await expect(menu(page)).toBeVisible();
}

async function save(page: Page): Promise<void> {
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", {
        timeout: 15_000,
    });
}

test.beforeEach(async ({ page }) => {
    await goHome(page);
    await createNote(page, "Block actions");
});

test("opens from the existing handle, duplicates, moves, undoes and persists through Markdown", async ({
    page,
}) => {
    await seed(page, '<h2 data-id="section-id"><strong>Section</strong></h2><p>First</p><p>Last</p>');
    const heading = editor(page).locator("h2");
    await heading.hover();
    const handle = page.getByRole("button", {
        name: "Block actions",
        exact: true,
    });
    await expect(handle).toHaveCSS("opacity", "1");
    await handle.click();
    await expect(menu(page).getByRole("menuitem", { name: "Move up", exact: true })).toBeDisabled();
    await menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(heading).toHaveCount(2);
    const ids = await heading.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-id")),
    );
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[1]).not.toBe(ids[0]);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(heading).toHaveCount(1);
    await openFor(page, editor(page).locator("p").filter({ hasText: "First" }));
    await page.keyboard.press("ArrowDown");
    await expect(menu(page).getByRole("menuitem", { name: "Move up", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(editor(page).locator(":scope > :first-child")).toHaveText("First");
    await expect(editor(page)).toBeFocused();
    await openFor(page, editor(page).locator("p").filter({ hasText: "Last" }));
    await expect(menu(page).getByRole("menuitem", { name: "Move down", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(editor(page)).toBeFocused();
    await save(page);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Markdown note editor", exact: true })).toContainText(
        "## **Section**",
    );
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(editor(page).locator(":scope > :first-child")).toHaveText("First");
    await page.reload();
    await expect(editor(page).locator("h2 strong")).toHaveText("Section");
    await expect(editor(page).locator(":scope > :first-child")).toHaveText("First");
});

test("converts inline formatting to lists and quotes, and refuses multi-block selections", async ({
    page,
}) => {
    await seed(page, '<p><strong>Bold</strong> <a href="https://example.com">link</a></p><p>Last</p>');
    await openFor(page, editor(page).locator("p").first());
    await menu(page).getByRole("menuitem", { name: "Heading 3", exact: true }).click();
    await expect(editor(page).locator("h3 strong")).toHaveText("Bold");
    await openFor(page, editor(page).locator("h3"));
    await menu(page).getByRole("menuitem", { name: "Checklist", exact: true }).click();
    await expect(editor(page).locator('ul[data-type="taskList"] strong')).toHaveText("Bold");
    await expect(editor(page).locator('ul[data-type="taskList"] a')).toHaveAttribute(
        "href",
        "https://example.com",
    );
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor(page).locator("h3")).toHaveText("Bold link");
    await openFor(page, editor(page).locator("h3"));
    await menu(page).getByRole("menuitem", { name: "Quote", exact: true }).click();
    await expect(editor(page).locator("blockquote h3")).toHaveText("Bold link");
    await openFor(page, editor(page).locator("blockquote h3"));
    await menu(page).getByRole("menuitem", { name: "Heading 3", exact: true }).click();
    await expect(editor(page).locator("blockquote")).toHaveCount(0);
    await editor(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Alt+Shift+m");
    await expect(menu(page)).toContainText("Place the cursor in a single block");
    await expect(menu(page).getByRole("menuitem", { name: "Duplicate", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(editor(page)).toContainText("Bold link");
    await save(page);
    await page.reload();
    await expect(editor(page).locator("h3 strong")).toHaveText("Bold");
});

test("moves nested list items inside their parent and retains children when duplicating", async ({
    page,
}) => {
    await seed(
        page,
        '<ol start="4"><li><p>Parent</p><ul><li><p>Nested first</p><ul><li><p>Child</p></li></ul></li><li><p>Nested last</p></li></ul></li><li><p>Sibling</p></li></ol>',
    );
    const nested = editor(page).locator("ol > li > ul");
    await openFor(page, nested.locator("p").filter({ hasText: /^Nested first$/ }));
    await expect(menu(page).getByRole("menuitem", { name: "Move up", exact: true })).toBeDisabled();
    await menu(page).getByRole("menuitem", { name: "Move down", exact: true }).click();
    await expect(nested.locator(":scope > li").first()).toHaveText("Nested last");
    await expect(nested.locator(":scope > li").last()).toContainText("Child");
    await openFor(page, nested.locator("p").filter({ hasText: /^Nested first$/ }));
    await expect(menu(page)).toContainText("cannot be converted without losing content");
    await menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(nested.locator(":scope > li")).toHaveCount(3);
    await expect(nested.getByText("Child", { exact: true })).toHaveCount(2);
    await save(page);
    await page.reload();
    await expect(editor(page).locator("ol")).toHaveAttribute("start", "4");
    await expect(nested.locator(":scope > li")).toHaveCount(3);
});

test("duplicates code, media and tables with metadata and explains unavailable conversions", async ({
    page,
}) => {
    await page.route("https://example.com/image.png", (route) =>
        route.fulfill({
            contentType: "image/png",
            body: Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
                "base64",
            ),
        }),
    );
    await seed(
        page,
        '<pre><code class="language-typescript">const value = 42;</code></pre><p>After code</p><table><tbody><tr><td><p>Cell</p></td></tr></tbody></table><p>Last</p>',
    );
    await openFor(page, editor(page).locator("td p"));
    await expect(menu(page)).toContainText("cannot be converted without losing content");
    await menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(editor(page).locator("table")).toHaveCount(2);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor(page).locator("table")).toHaveCount(1);
    await editor(page)
        .locator("p")
        .filter({ hasText: /^After code$/ })
        .click();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Alt+Shift+m");
    await expect(menu(page)).toContainText("cannot be converted without losing content");
    await menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(editor(page).locator(".code-content-renderer")).toHaveCount(2);
    await save(page);
    await page.reload();
    await expect(editor(page).locator(".code-content-renderer")).toHaveCount(2);
    await seed(
        page,
        '<p>Before</p><img src="https://example.com/image.png" alt="Reference" width="140px"><p>After</p>',
    );
    await editor(page).locator("img").hover();
    await page.getByRole("button", { name: "Block actions", exact: true }).click();
    await expect(menu(page)).toContainText("cannot be converted without losing content");
    await menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(editor(page).locator('img[alt="Reference"]')).toHaveCount(2);
    await save(page);
    await page.reload();
    await expect(editor(page).locator('img[alt="Reference"]')).toHaveCount(2);
});

test("Escape closes the block menu before the floating window and Vim remains usable", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Vim mode", exact: true }).check();
    await page.goto("/floating-editor");
    await expect(editor(page)).toBeVisible();
    await seed(page, "<p>one two three</p>");
    await editor(page).click();
    await page.keyboard.type("gg0");
    await page.keyboard.press("Alt+Shift+m");
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveAttribute("data-neovim-mode", "normal");
    await expect(page).toHaveURL(/floating-editor$/);
    await page.keyboard.type("dw");
    await expect(editor(page)).toHaveText("two three");
});

test("retains the existing dragstart behavior on the same handle", async ({ page }) => {
    await seed(page, "<p>First</p><p>Last</p>");
    await editor(page).locator("p").first().hover();
    const handle = page.getByRole("button", {
        name: "Block actions",
        exact: true,
    });
    expect(await handle.getAttribute("draggable")).toBe("true");
    const draggedText = await handle.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const dataTransfer = new DataTransfer();
        element.dispatchEvent(
            new DragEvent("dragstart", {
                clientX: rect.x + rect.width / 2,
                clientY: rect.y + rect.height / 2,
                dataTransfer,
                bubbles: true,
                cancelable: true,
            }),
        );
        element.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
        return dataTransfer.getData("text/plain");
    });
    expect(draggedText).toBe("First");
    await expect(menu(page)).toBeHidden();
    await handle.click();
    await expect(menu(page)).toBeVisible();
});

test.describe("narrow touch screen", () => {
    test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });

    test("opens a touch-sized handle and keeps the full menu within the viewport", async ({ page }) => {
        await seed(page, "<p>Touch first</p><p>Touch last</p>");
        await editor(page).locator("p").first().tap();
        const handle = page.getByRole("button", {
            name: "Block actions",
            exact: true,
        });
        await expect(handle).toHaveCSS("opacity", "1");
        const bounds = await handle.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        await handle.tap();
        await expect(menu(page)).toBeVisible();
        await page.keyboard.press("End");
        await expect(menu(page)).toBeVisible();
        await page.keyboard.press("Home");
        const menuBounds = await menu(page).boundingBox();
        expect(menuBounds!.x).toBeGreaterThanOrEqual(8);
        expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(382);
        expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(692);
        await menu(page).getByRole("menuitem", { name: "Heading 2", exact: true }).tap();
        await expect(editor(page).locator("h2")).toHaveText("Touch first");
        await save(page);
        await page.reload();
        await expect(editor(page).locator("h2")).toHaveText("Touch first");
    });
});
