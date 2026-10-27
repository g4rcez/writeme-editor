import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const beforeTable = "Release review before the table.";
const afterTable = "After the table, confirm the release notes.";
const savedEdit = " Saved after reviewing the table.";
const overflowText = "Keep the rollback plan and notify support with release-id.";

async function storedNoteDigest(page: Page, id: string): Promise<string> {
    return page.evaluate(async (noteId) => {
        const { repositories } = await import("/packages/editor/src/store/repositories/index.ts");
        const note = await repositories.notes.getOne(noteId);
        if (!note) throw new Error(`Note ${noteId} was not found.`);
        const bytes = new TextEncoder().encode(note.content);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }, id);
}

async function focusedTableCell(editor: Locator): Promise<{ rowIndex: number; cellIndex: number } | null> {
    return editor.evaluate((element) => {
        const focusNode = element.ownerDocument.getSelection()?.focusNode;
        const focusElement = focusNode instanceof Element ? focusNode : focusNode?.parentElement;
        const cell = focusElement?.closest("td, th");
        const row = cell?.closest("tr");
        if (!(cell instanceof HTMLTableCellElement) || !row) return null;
        return { rowIndex: row.rowIndex, cellIndex: cell.cellIndex };
    });
}
const unevenTableMarkdown = [
    beforeTable,
    "",
    "| Work | Owner | Status |",
    "| :--- | :---: | ---: | --- |",
    "| Draft | Ada | Ready |",
    "| Review | Lin |",
    "| Ship | Jo | Approved | **Keep the rollback plan** and *notify support* with `release-id`. |",
    "",
    afterTable,
].join("\n");
const endOfDocument = process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End";

async function expectPreservedTable(editor: Locator, afterText: string): Promise<void> {
    const table = editor.getByRole("table");
    await expect(table).toHaveCount(1);
    await expect(table).toBeVisible();
    const rows = table.getByRole("row");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0).getByRole("columnheader")).toHaveText(["Work", "Owner", "Status", ""]);
    await expect(rows.nth(1).getByRole("cell")).toHaveText(["Draft", "Ada", "Ready", ""]);
    await expect(rows.nth(2).getByRole("cell")).toHaveText(["Review", "Lin", "", ""]);
    await expect(rows.nth(3).getByRole("cell")).toHaveText(["Ship", "Jo", "Approved", overflowText]);

    const overflowCell = rows.nth(3).getByRole("cell").nth(3);
    await expect(overflowCell).toBeVisible();
    await expect(overflowCell.locator("strong")).toHaveText("Keep the rollback plan");
    await expect(overflowCell.locator("em")).toHaveText("notify support");
    await expect(overflowCell.locator("code")).toHaveText("release-id");
    const precedingParagraph = editor.locator(":scope > p").filter({ hasText: beforeTable });
    await expect(precedingParagraph).toHaveText(beforeTable);
    await expect(precedingParagraph).toBeVisible();
    const followingParagraph = editor.locator(":scope > p").filter({ hasText: afterTable });
    await expect(followingParagraph).toHaveText(afterText);
    await expect(followingParagraph).toBeVisible();
    await expect(editor).not.toContainText("| :---");
    await table.scrollIntoViewIfNeeded();
}

const tableCases = [
    ["uneven", unevenTableMarkdown],
    ["header-indented uneven", unevenTableMarkdown.replace("| Work", " | Work")],
    ["delimiter-indented uneven", unevenTableMarkdown.replace("| :---", "   | :---")],
    [
        "both-indented overflow",
        unevenTableMarkdown
            .replace("| Work", "  | Work")
            .replace("| :--- | :---: | ---: | --- |", "  | :--- | :---: | ---: |"),
    ],
] as const;

for (const [tableCase, tableMarkdown] of tableCases) {
    for (const [size, action] of [
        ["normal", "opening"],
        ["normal", "pasting"],
        ["large", "opening"],
        ["large", "pasting"],
    ] as const) {
        test(`preserves ${size} ${tableCase} markdown table cells and formatting when ${action} and reopening a note`, async ({
            cleanPage: page,
        }, testInfo) => {
            if (size === "large") test.setTimeout(120_000);
            await page.setViewportSize({ width: 1440, height: 1000 });
            const title = `Table ${tableCase} ${size} ${action}`;
            // One long paragraph crosses the 50,000-character worker threshold without exercising line chunking.
            const markdown =
                size === "large" ? `${"Release background. ".repeat(2600)}\n\n${tableMarkdown}` : tableMarkdown;
            // Seed storage in-page, then open through All notes because desktop browser builds have no Markdown file import.
            await page.goto("/", { waitUntil: "commit" });
            const id = await page.evaluate(
                async ({ title, content }) => {
                    // Browser-only modules must load inside the page, not in Playwright's Node process.
                    const repositoryModule = "/packages/editor/src/store/repositories/index.ts";
                    const noteModule = "/packages/editor/src/store/note.ts";
                    const { repositories } = await import(repositoryModule);
                    const { Note } = await import(noteModule);
                    const note = Note.new(title, content);
                    await repositories.notes.save(note);
                    return note.id;
                },
                { title, content: action === "opening" ? markdown : "" },
            );
            await page.getByRole("link", { name: "All notes", exact: true }).click();
            await expect(page).toHaveURL(/\/notes$/);
            await expect(page.getByRole("heading", { name: "All notes", exact: true })).toBeVisible();
            await page.getByRole("link", { name: title, exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`/note/${id}$`));
            const noteUrl = page.url();

            const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
            await expect(editor).toBeVisible({ timeout: 20_000 });
            await expect(editor).toHaveAttribute("contenteditable", "true", { timeout: 20_000 });
            if (action === "pasting") {
                await editor.click();
                await editor.press(endOfDocument);
                await editor.evaluate((element, text) => {
                    const clipboardData = new DataTransfer();
                    clipboardData.setData("text/plain", text);
                    element.dispatchEvent(
                        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
                    );
                }, markdown);
            }

            await expectPreservedTable(editor, afterTable);
            await page.screenshot({ path: testInfo.outputPath(`uneven-table-${size}-${action}.png`) });

            await editor.locator(":scope > p").filter({ hasText: afterTable }).click();
            await editor.press(endOfDocument);
            await page.keyboard.type(savedEdit);
            const saveStatus = page.locator(".writeme-editor-status-bar output").first();
            await expect(saveStatus).toHaveText("Unsaved changes");
            await editor.press("ControlOrMeta+s");
            await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(page).toHaveURL(noteUrl);
            await expect(editor).toBeVisible({ timeout: 20_000 });
            await expect(editor).toHaveAttribute("contenteditable", "true", { timeout: 20_000 });
            await expectPreservedTable(editor, afterTable + savedEdit);
            await page.screenshot({ path: testInfo.outputPath(`uneven-table-${size}-${action}-reopened.png`) });
        });
    }
}

test("offers table row and column controls plus row keyboard shortcuts", async ({ cleanPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "commit" });
    const noteId = await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/repositories/index.ts");
        const { Note } = await import("/packages/editor/src/store/note.ts");
        const content = ["| Item | Owner |", "| --- | --- |", "| Draft | Ada |", "| Ship | Lin |"].join("\n");
        const note = Note.new("Table controls", content);
        await repositories.notes.save(note);
        return note.id;
    });

    await page.goto(`/note/${noteId}`, { waitUntil: "domcontentloaded" });
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "true", { timeout: 20_000 });
    const table = editor.getByRole("table");
    const rows = table.getByRole("row");
    await expect(rows).toHaveCount(3);

    const headerBackground = await rows
        .first()
        .getByRole("columnheader")
        .first()
        .evaluate((cell) => getComputedStyle(cell).backgroundColor);
    const rowHeaderBackground = await rows
        .nth(1)
        .getByRole("cell")
        .first()
        .evaluate((cell) => getComputedStyle(cell).backgroundColor);
    const bodyBackground = await rows
        .nth(1)
        .getByRole("cell")
        .nth(1)
        .evaluate((cell) => getComputedStyle(cell).backgroundColor);
    expect(headerBackground).not.toBe(bodyBackground);
    expect(rowHeaderBackground).not.toBe(bodyBackground);

    const insertRowBelow = page.getByRole("button", { name: "Insert row below" });
    await table.getByRole("cell", { name: "Ada" }).hover();
    await insertRowBelow.hover();
    await expect(page.getByRole("tooltip")).toContainText("Ctrl+Backspace deletes this row.");
    await insertRowBelow.click();
    await expect(rows).toHaveCount(4);
    await expect(editor).toBeFocused();
    await expect.poll(() => focusedTableCell(editor)).toEqual({ rowIndex: 2, cellIndex: 1 });

    const insertRowAbove = page.getByRole("button", { name: "Insert row above" });
    await table.getByRole("cell", { name: "Lin" }).hover();
    await insertRowAbove.hover();
    await expect(page.getByRole("tooltip")).toContainText("Add a blank row above this row.");
    await insertRowAbove.click();
    await expect(rows).toHaveCount(5);
    await expect(editor).toBeFocused();
    await expect.poll(() => focusedTableCell(editor)).toEqual({ rowIndex: 3, cellIndex: 1 });

    const insertColumnLeft = page.getByRole("button", { name: "Insert column left" });
    await table.getByRole("cell", { name: "Draft" }).hover();
    await insertColumnLeft.hover();
    await expect(page.getByRole("tooltip")).toContainText("Add a blank column to the left");
    await insertColumnLeft.click();
    await expect(rows.first().getByRole("columnheader")).toHaveCount(3);
    await expect(editor).toBeFocused();
    await expect.poll(() => focusedTableCell(editor)).toEqual({ rowIndex: 1, cellIndex: 0 });

    const insertColumnRight = page.getByRole("button", { name: "Insert column right" });
    await table.getByRole("cell", { name: "Draft" }).hover();
    await insertColumnRight.hover();
    await expect(page.getByRole("tooltip")).toContainText("Add a blank column to the right");
    await insertColumnRight.click();
    await expect(rows.first().getByRole("columnheader")).toHaveCount(4);
    await expect(editor).toBeFocused();
    await expect.poll(() => focusedTableCell(editor)).toEqual({ rowIndex: 1, cellIndex: 2 });

    await table.getByRole("cell", { name: "Ada" }).click();
    await editor.press("Control+Enter");
    await expect(rows).toHaveCount(6);
    await expect(editor).toBeFocused();
    await expect.poll(() => focusedTableCell(editor)).toEqual({ rowIndex: 2, cellIndex: 3 });

    await table.getByRole("cell", { name: "Ship" }).click();
    await editor.press("Control+Backspace");
    await expect(rows).toHaveCount(5);
    await expect(table).not.toContainText("Ship");
});

test("keeps saved large note content after canceled Markdown worker loading", async ({ cleanPage: page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "commit" });

    const noteId = await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/repositories/index.ts");
        const { Note } = await import("/packages/editor/src/store/note.ts");
        const { WARN_THRESHOLD } = await import("/packages/editor/src/lib/markdown-worker/index.ts");
        const prefix = "Keep the original note content intact. ";
        const content = `${prefix}${"x".repeat(WARN_THRESHOLD + 1 - prefix.length)}`;
        const note = Note.new("Canceled large note", content);
        await repositories.notes.save(note);
        return note.id;
    });
    const savedDigest = await storedNoteDigest(page, noteId);

    await page.goto(`/note/${noteId}`, { waitUntil: "commit" });
    await expect(page.getByText("Large document", { exact: true })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(
        page.getByText("Loading was canceled. The saved note is unchanged. Reload to try again."),
    ).toBeVisible();
    await page.keyboard.press("ControlOrMeta+s");
    expect(await storedNoteDigest(page, noteId)).toBe(savedDigest);
});

test("keeps saved large note content after Markdown worker failure", async ({ cleanPage: page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
        const originalPostMessage = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, transfer) {
            if (typeof message === "object" && message !== null && "text" in message) {
                const generation = (message as { gen?: unknown }).gen;
                if (typeof generation === "number") {
                    queueMicrotask(() => {
                        this.dispatchEvent(
                            new MessageEvent("message", {
                                data: { type: "error", gen: generation, error: "simulated worker failure" },
                            }),
                        );
                    });
                    return;
                }
            }
            return Reflect.apply(originalPostMessage, this, transfer === undefined ? [message] : [message, transfer]);
        };
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "commit" });

    const noteId = await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/repositories/index.ts");
        const { Note } = await import("/packages/editor/src/store/note.ts");
        const content = `Keep the original note content intact. ${"Existing content must survive worker failure. ".repeat(2_000)}`;
        const note = Note.new("Failed large note", content);
        await repositories.notes.save(note);
        return note.id;
    });
    const savedDigest = await storedNoteDigest(page, noteId);

    await page.goto(`/note/${noteId}`, { waitUntil: "domcontentloaded" });
    await expect(
        page.getByText("Could not parse the saved note. Its content is unchanged. Reload to try again."),
    ).toBeVisible({ timeout: 30_000 });

    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await page.keyboard.press("ControlOrMeta+s");
    expect(await storedNoteDigest(page, noteId)).toBe(savedDigest);
});
