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

test("keeps saved large note content after canceled or failed Markdown worker loading", async ({ cleanPage: page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "commit" });

    const savedNotes = await page.evaluate(async () => {
        const { repositories } = await import("/packages/editor/src/store/repositories/index.ts");
        const { Note } = await import("/packages/editor/src/store/note.ts");
        const cancelledContent = `Keep the original note content intact. ${"Existing content must survive cancellation. ".repeat(55_000)}`;
        const failedContent = `Keep the original note content intact. ${"Existing content must survive worker failure. ".repeat(2_000)}`;
        const cancelledNote = Note.new("Canceled large note", cancelledContent);
        const failedNote = Note.new("Failed large note", failedContent);
        await repositories.notes.save(cancelledNote);
        await repositories.notes.save(failedNote);

        const { getMarkdownWorker } = await import("/packages/editor/src/lib/markdown-worker/index.ts");
        const worker = getMarkdownWorker();
        worker.postMessage = ((message: unknown) => {
            const { gen } = message as { gen: number };
            queueMicrotask(() => {
                worker.dispatchEvent(
                    new MessageEvent("message", {
                        data: { type: "error", gen, error: "simulated worker failure" },
                    }),
                );
            });
        }) as typeof worker.postMessage;

        return { cancelledId: cancelledNote.id, failedId: failedNote.id };
    });
    const cancelledDigest = await storedNoteDigest(page, savedNotes.cancelledId);
    const failedDigest = await storedNoteDigest(page, savedNotes.failedId);

    await page.getByRole("link", { name: "All notes", exact: true }).click();
    await page.getByRole("link", { name: "Canceled large note", exact: true }).click();
    await expect(page.getByText("Large document", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(
        page.getByText("Loading was canceled. The saved note is unchanged. Reload to try again."),
    ).toBeVisible();
    await page.keyboard.press("ControlOrMeta+s");
    expect(await storedNoteDigest(page, savedNotes.cancelledId)).toBe(cancelledDigest);

    await page.getByRole("link", { name: "All notes", exact: true }).click();
    await page.getByRole("link", { name: "Failed large note", exact: true }).click();
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(
        page.getByText("Could not parse the saved note. Its content is unchanged. Reload to try again."),
    ).toBeVisible();
    await page.keyboard.press("ControlOrMeta+s");
    expect(await storedNoteDigest(page, savedNotes.failedId)).toBe(failedDigest);
});
