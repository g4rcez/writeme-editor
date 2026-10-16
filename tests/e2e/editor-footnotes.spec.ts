import type { Page } from "@playwright/test";
import { createNote, expect, goHome, test } from "./fixtures";

async function importMarkdown(page: Page, markdown: string): Promise<void> {
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    await page.locator(".cm-content").first().fill(markdown);
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.locator('output[aria-label="Note save status"]').first()).toHaveText("Saved", {
        timeout: 15_000,
    });
}

async function editorDocument(page: Page): Promise<unknown> {
    return page.evaluate(async () => {
        // This import must run in the browser realm to inspect the live editor, not in Playwright's Node process.
        const modulePath = "/packages/editor/src/app/editor-global-ref.tsx";
        const { editorGlobalRef } = await import(modulePath);
        return editorGlobalRef.current.getJSON();
    });
}

test("keeps pipe IDs in tables and ordinary caret-labelled links through raw, clipboard and saved reload", async ({
    cleanPage: page,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await goHome(page);
    await createNote(page, "Portable footnote IDs and links");
    const markdown =
        "| Claim |\n| --- |\n| A [^a\\|b]. |\n\n[^manual](https://example.com) [^guide][target] [^real](not a valid link) \\[^literal].\n\n[target]: https://example.org\n\n[^a|b]: **Source**\n\n[^real]: Parenthetical source";
    await importMarkdown(page, markdown);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const original = await editorDocument(page);
    for (let i = 0; i < 2; i++) {
        await expect(editor.locator("tr")).toHaveCount(2);
        await expect(editor.locator("tr").last().locator("td")).toHaveCount(1);
        await expect(editor.locator("td")).toHaveText("A a|b.");
        await expect(editor.locator('td [data-footnote-reference="a|b"]')).toHaveCount(1);
        await expect(editor.locator('a[href="https://example.com"]')).toHaveText("^manual");
        await expect(editor.locator('a[href="https://example.org"]')).toHaveText("^guide");
        await expect(editor.locator('[data-footnote-reference="real"]')).toHaveCount(1);
        await expect(editor.locator('[data-footnote-reference="literal"]')).toHaveCount(0);
        await expect(editor).toContainText("(not a valid link) [^literal].");
        await editor.locator("p").first().click();
        await editor.press("ControlOrMeta+A");
        await page.keyboard.press("ControlOrMeta+C");
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toContain("| A [^a\\|b]. |");
        expect(copied).toContain("[^a|b]: **Source**");
        await page.getByRole("button", { name: "Markdown", exact: true }).click();
        await expect(page.locator(".cm-content").first()).toContainText("| A [^a\\|b]. |");
        await page.getByRole("button", { name: "Formatted", exact: true }).click();
        expect(await editorDocument(page)).toEqual(original);
        await expect(page.locator('output[aria-label="Note save status"]').first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await page.reload();
        await expect(editor.locator('[data-footnote-reference="a|b"]')).toHaveCount(1);
        expect(await editorDocument(page)).toEqual(original);
    }
});

test("authors, previews, navigates, saves and round-trips Markdown footnotes", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Footnote workflow");

    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("Body text ");
    await page.keyboard.type("/footnote");
    const menu = page.getByRole("listbox", { name: "Slash command suggestions" });
    await expect(menu.getByText("Footnote", { exact: true })).toBeVisible();
    await menu.getByText("Footnote", { exact: true }).click();
    await page.getByLabel("Footnote name").fill("bibliography");
    await page.getByRole("button", { name: "Insert", exact: true }).click();

    const reference = page.getByRole("button", { name: "Footnote bibliography", exact: true });
    await expect(reference).toBeVisible();
    await expect(
        editor
            .locator('[data-footnote-definition="bibliography"]')
            .getByRole("button", { name: "Return to reference" }),
    ).toBeEnabled();
    await reference.hover();
    await expect(page.getByRole("dialog")).toContainText("This footnote definition is empty.");

    await reference.click();
    await page.getByRole("button", { name: "Go to definition", exact: true }).click();
    const definition = editor.locator('[data-footnote-definition="bibliography"]');
    await expect(definition).toBeVisible();
    await expect(definition.getByText("Footnote bibliography", { exact: true })).toBeVisible();
    await definition.locator("p").click();
    await page.keyboard.type("Source details in this footnote.");
    await definition.getByRole("button", { name: "Return to reference" }).click();
    await expect(reference).toBeFocused();
    await reference.hover();
    await expect(page.getByRole("dialog")).toContainText("Source details in this footnote.");
    const status = page.locator(".writeme-editor-status-bar output").first();
    await expect(status).toHaveText("Unsaved changes");
    await expect(status).toHaveText("Saved", { timeout: 15_000 });

    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const rawEditor = page.locator(".cm-content").first();
    await expect(rawEditor).toContainText("[^bibliography]");
    await expect(rawEditor).toContainText("[^bibliography]:");
    await expect(rawEditor).not.toContainText("[^fn-1]");
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await page.reload();

    const reloadedEditor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(reloadedEditor.getByRole("button", { name: "Footnote bibliography", exact: true })).toBeVisible();
    await expect(reloadedEditor.locator('[data-footnote-definition="bibliography"]')).toBeVisible();
    await expect(reloadedEditor.locator('[data-footnote-definition="bibliography"] p')).toHaveText(
        "Source details in this footnote.",
    );
});

test("keyboard previews expose missing definitions, duplicates, and return navigation", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Footnote edge cases");
    await importMarkdown(
        page,
        "Missing [^missing]. First [^cite] and second [^cite].\n\n[^cite]: Original source\n\n[^cite]: Duplicate source\n\n[^orphan]: Unreferenced source",
    );
    const missing = page.getByRole("button", { name: "Footnote missing", exact: true });
    await missing.focus();
    await expect(page.getByRole("dialog")).toContainText("Footnote definition “missing” is missing.");
    await expect(page.getByRole("button", { name: "Go to definition" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(missing).toBeFocused();

    const references = page.getByRole("button", { name: "Footnote cite", exact: true });
    await references.nth(1).focus();
    await expect(page.getByRole("dialog")).toContainText("Original source");
    await references.nth(1).press("ArrowDown");
    const navigation = page.getByRole("button", { name: "Go to definition", exact: true });
    await expect(navigation).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(references.nth(1)).toBeFocused();
    await references.nth(1).press("ArrowDown");
    await navigation.press("Enter");
    const definitions = page.locator('[data-footnote-definition="cite"]');
    await expect(definitions).toHaveCount(2);
    await expect(definitions.first()).toContainText("Duplicate ID; references open the first definition.");
    await expect
        .poll(() =>
            definitions.first().evaluate((element) => element.contains(window.getSelection()?.anchorNode ?? null)),
        )
        .toBe(true);
    await definitions.first().getByRole("button", { name: "Return to reference" }).click();
    await expect(references.nth(1)).toBeFocused();
    await expect(page.locator('[data-footnote-definition="orphan"]')).toContainText("No references to this footnote.");
});

test("deletes a footnote and its linked references with one undo", async ({ cleanPage: page }, testInfo) => {
    await goHome(page);
    await createNote(page, "Delete footnote");
    await importMarkdown(page, "One [^source] and two [^source].\n\n[^source]: Shared source");
    await page.reload();

    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const references = editor.getByRole("button", { name: "Footnote source", exact: true });
    const definition = editor.locator('[data-footnote-definition="source"]');
    await expect(references).toHaveCount(2);
    await definition.getByRole("button", { name: "Delete footnote source" }).click();
    await expect(references).toHaveCount(0);
    await expect(definition).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("footnote-deletion.png") });

    await page.keyboard.press("ControlOrMeta+Z");
    await expect(references).toHaveCount(2);
    await expect(definition).toHaveCount(1);
});

test("pastes portable footnotes and preserves shared definitions through deletion and undo", async ({
    cleanPage: page,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await goHome(page);
    await createNote(page, "Clipboard footnotes");
    const markdown = "First [^a] and second [^a].\n\n[^a]: **Shared source**\n    continued details.";
    await page.evaluate((text) => navigator.clipboard.writeText(text), markdown);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+V");
    const references = editor.getByRole("button", { name: "Footnote a", exact: true });
    await expect(references).toHaveCount(2);
    await expect(editor.locator('[data-footnote-definition="a"] strong')).toHaveText("Shared source");
    await expect(page.locator('output[aria-label="Note save status"]').first()).toHaveText("Saved", {
        timeout: 15_000,
    });
    await editor.locator("p").first().click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowLeft" : "Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Delete");
    await expect(references).toHaveCount(1);
    await expect(editor.locator('[data-footnote-definition="a"] strong')).toHaveText("Shared source");
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(references).toHaveCount(2);
    await editor.press("ControlOrMeta+A");
    await page.keyboard.press("ControlOrMeta+C");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.match(/\[\^a\](?!:)/g)).toHaveLength(2);
    expect(copied).toContain("[^a]: **Shared source**");
    expect(copied).toContain("continued details.");
});

test.describe("footnotes on a narrow touch screen", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test("previews an unresolved reference with touch", async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Missing touch footnote");
        await importMarkdown(page, "Body [^missing].");
        await expect(page.getByRole("button", { name: "Footnote missing", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Footnote missing", exact: true }).tap();
        await expect(page.getByRole("dialog")).toContainText("is missing.");
    });
    test("opens a usable preview and navigates with touch", async ({ cleanPage: page }, testInfo) => {
        await goHome(page);
        await createNote(page, "Touch footnote");
        await importMarkdown(page, "Body [^touch].\n\n[^touch]: " + "A long source with readable details. ".repeat(12));
        const reference = page.getByRole("button", { name: "Footnote touch", exact: true });
        await reference.tap();
        const preview = page.getByRole("dialog");
        await expect(preview).toBeVisible();
        const bounds = await preview.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        const action = page.getByRole("button", { name: "Go to definition", exact: true });
        await action.scrollIntoViewIfNeeded();
        await action.tap();
        const definition = page.locator('[data-footnote-definition="touch"]');
        await expect
            .poll(() => definition.evaluate((element) => element.contains(window.getSelection()?.anchorNode ?? null)))
            .toBe(true);
        await definition.getByRole("button", { name: "Return to reference" }).tap();
        await expect(reference).toBeFocused();
        await page.screenshot({ path: testInfo.outputPath("footnote-touch.png") });
    });
});

test("imports shared and multiline definitions and keeps rich/raw roundtrips", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Imported footnotes");
    await importMarkdown(
        page,
        "First [^cite] and second [^cite].\n\n[^cite]: A **formatted** source\n    with a second line.",
    );

    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor.getByRole("button", { name: "Footnote cite", exact: true })).toHaveCount(2);
    await expect(editor.locator('[data-footnote-definition="cite"]')).toContainText("A formatted source");

    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const rawEditor = page.locator(".cm-content").first();
    await expect(rawEditor).toContainText("[^cite]:");
    await expect(rawEditor).toContainText("**formatted**");
    await expect(rawEditor).toContainText("second line.");
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await page.reload();
    await expect(editor.getByRole("button", { name: "Footnote cite", exact: true })).toHaveCount(2);
    await expect(editor.locator('[data-footnote-definition="cite"] strong')).toHaveText("formatted");
});

test("preserves footnotes through the large-document worker and saved reload", async ({ cleanPage: page, context }) => {
    test.setTimeout(120_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await goHome(page);
    await createNote(page, "Large footnote import");
    const code = "first line\n\n**keep literal**";
    const markdown =
        "First [^first].\n\n[^first]:\n\n    ```text\n    first line\n    \n    **keep literal**\n    ```\n\n" +
        ("Context ".repeat(35) + "\n\n").repeat(220) +
        "Body [^large] and again [^large].\n\n[^large]: A **large-document source**.\n\n    A second definition paragraph.\n\n    ```text\n    first line\n    \n    **keep literal**\n    ```";
    await page.evaluate((text) => navigator.clipboard.writeText(text), markdown);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(editor.getByRole("button", { name: "Footnote large", exact: true })).toHaveCount(2, {
        timeout: 60_000,
    });
    const definition = editor.locator('[data-footnote-definition="large"]');
    await expect(definition.locator("strong")).toHaveText("large-document source");
    await expect(definition.locator("p")).toHaveCount(2);
    await expect(definition).toContainText("A second definition paragraph.");
    await expect(editor.locator('[data-footnote-definition="first"] code')).toHaveText(code);
    await expect(definition.locator("code")).toHaveText(code);
    const original = await editorDocument(page);
    await expect(page.locator('output[aria-label="Note save status"]').first()).toHaveText("Saved", {
        timeout: 15_000,
    });
    await page.reload();
    await expect(editor.getByRole("button", { name: "Footnote large", exact: true })).toHaveCount(2, {
        timeout: 60_000,
    });
    await expect(definition.locator("p")).toHaveCount(2);
    await expect(editor.locator('[data-footnote-definition="first"] code')).toHaveText(code);
    await expect(definition.locator("code")).toHaveText(code);
    expect(await editorDocument(page)).toEqual(original);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const rawEditor = page.locator(".cm-content").first();
    await rawEditor.press(process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End");
    await expect(rawEditor).toContainText("[^large]: A **large-document source**.");
});
