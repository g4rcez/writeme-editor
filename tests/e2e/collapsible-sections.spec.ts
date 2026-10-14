import type { Page } from "@playwright/test";
import { createNote, expect, goHome, test } from "./fixtures";

const markdown =
    "# Parent\n\nParent body\n\n## Child\n\nHidden needle\n\n- [ ] Nested task\n\n### Grandchild\n\nDeep body\n\n# Next\n\nVisible body";

async function setup(page: Page, title = "Folding test", initial = true): Promise<string> {
    if (initial) await goHome(page);
    const url = await createNote(page, title);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.fill(markdown);
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Unsaved changes");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", { timeout: 15_000 });
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.getByRole("button", { name: "Collapse Parent", exact: true })).toBeVisible();
    await expect(page.locator(".ProseMirror h1").first()).toHaveAttribute("data-id", /\S+/);
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", { timeout: 15_000 });
    return url;
}

test("keeps nested folds across reload while preserving raw and print content", async ({
    cleanPage: page,
}, testInfo) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await expect(editor.locator("h2")).toBeHidden();
    await expect(editor.getByText("Visible body", { exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand Parent", exact: true })).toHaveAttribute(
        "aria-expanded",
        "false",
    );
    await page.getByRole("button", { name: "Expand Parent", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await expect(raw).toContainText("Hidden needle");
    await expect(raw).toContainText("Deep body");
    await expect(raw).toContainText("- [ ] Nested task");
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("nested-folds.png") });
});

test("keeps folding state isolated when opening and returning to another note", async ({ cleanPage: page }) => {
    const url = await setup(page);
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    await setup(page, "Independent folding note", false);
    await expect(page.getByRole("button", { name: "Collapse Child", exact: true })).toBeVisible();
    await page.goto(url);
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
});

test("reveals hidden matches and outline targets and keeps task controls usable", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+f");
    await page.getByRole("textbox", { name: "Find text", exact: true }).fill("Hidden needle");
    await expect(editor.locator(".search-result-current")).toHaveText("Hidden needle");
    await expect(editor.locator(".search-result-current")).toBeVisible();
    await page.keyboard.press("Escape");
    const task = editor.locator('input[type="checkbox"]').first();
    await task.check();
    await expect(task).toBeChecked();
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await page.getByRole("button", { name: "Open table of contents", exact: true }).click();
    await page
        .getByRole("dialog", { name: "Table of contents", exact: true })
        .getByRole("button", { name: "Grandchild", exact: true })
        .click();
    await expect(editor.locator("h3")).toBeVisible();
    await expect(editor.getByText("Deep body", { exact: true })).toBeVisible();
    await expect(task).toBeChecked();
    await page.getByRole("button", { name: "Open note context", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Context", exact: true });
    await panel.getByRole("button", { name: "Collapse all", exact: true }).click();
    await expect(editor.locator("h2")).toBeHidden();
    await panel.getByRole("button", { name: "Child", exact: true }).click();
    await expect(editor.locator("h2")).toBeVisible();
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await expect(editor.getByText("Visible body", { exact: true })).toBeHidden();
    await panel.getByRole("button", { name: "Expand all", exact: true }).click();
    await expect(editor.getByText("Visible body", { exact: true })).toBeVisible();
});

test("supports keyboard disclosure, Vim, heading edits, and undo", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    const control = page.getByRole("button", { name: "Collapse Parent", exact: true });
    await editor.locator("h1").first().click();
    await editor.evaluate((element) => {
        const event = new KeyboardEvent("keydown", {
            key: "[",
            code: "BracketLeft",
            ctrlKey: true,
            altKey: true,
            modifierAltGraph: true,
            bubbles: true,
            cancelable: true,
        });
        if (!event.getModifierState("AltGraph")) throw new Error("AltGraph event was not configured");
        element.dispatchEvent(event);
    });
    await expect(control).toHaveAttribute("aria-expanded", "true");
    await expect(editor.locator("h2")).toBeVisible();
    await control.focus();
    await page.keyboard.press("Enter");
    const expandedControl = page.getByRole("button", { name: "Expand Parent", exact: true });
    await expect(expandedControl).toBeFocused();
    await expect(editor.locator("h2")).toBeHidden();
    await page.keyboard.press("Space");
    await expect(control).toBeFocused();
    await expect(editor.locator("h2")).toBeVisible();
    await editor.locator("h1").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
    await expect(expandedControl).toBeVisible();
    await page.keyboard.type("Revised ");
    await expect(editor.locator("h2")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor.locator("h1").first()).toHaveText("Parent");
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
    await expect(editor.locator("h2")).toBeHidden();
    await page.keyboard.press("ControlOrMeta+Alt+0");
    await expect(editor.locator("h1")).toHaveCount(1);
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor.locator("h1").first()).toHaveText("Parent");
    await page.getByRole("checkbox", { name: "Vim mode", exact: true }).check();
    await editor.locator("h1").first().click();
    await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
    await expect(expandedControl).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+BracketRight");
    await expect(control).toBeVisible();
    await page.keyboard.type("j");
    await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
    await expect(editor.getByText("Hidden needle", { exact: true })).toBeVisible();
});

test("keeps sentence comments usable after folding and revealing their section", async ({ cleanPage: page }) => {
    await setup(page);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.focus();
    await editor.evaluate((element) => {
        const paragraph = Array.from(element.querySelectorAll("p")).find(
            (node) => node.textContent === "Hidden needle",
        );
        if (!paragraph) throw new Error("Comment text is missing");
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
    });
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments", exact: true });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep this detail");
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel).toContainText("Keep this detail");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
    await expect(editor.getByRole("link", { name: "Hidden needle", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Expand Parent", exact: true }).click();
    await editor.getByRole("link", { name: "Hidden needle", exact: true }).click();
    await expect(panel).toContainText("Keep this detail");
});

test.describe("touch disclosure", () => {
    test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
    test("has reachable disclosure controls on narrow screens", async ({ cleanPage: page }, testInfo) => {
        await setup(page);
        const control = page.getByRole("button", { name: "Collapse Parent", exact: true });
        const bounds = await control.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        await control.tap();
        await expect(page.getByRole("button", { name: "Expand Parent", exact: true })).toBeVisible();
        await expect(page.locator(".ProseMirror h2")).toBeHidden();
        await page.getByRole("button", { name: "Expand Parent", exact: true }).tap();
        await expect(page.locator(".ProseMirror h2")).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath("touch-disclosures.png") });
    });
});

for (const visual of ["V", "v"] as const) {
    for (const collapse of ["disclosure", "all"] as const) {
        for (const operator of ["d", "c"] as const) {
            test(`protects hidden body after Vim ${visual}, ${collapse}, ${operator}`, async ({ cleanPage: page }) => {
                await setup(page);
                const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
                await page.getByRole("checkbox", { name: "Vim mode", exact: true }).check();
                if (collapse === "all")
                    await page.getByRole("button", { name: "Open note context", exact: true }).click();
                await editor.focus();
                await page.keyboard.type(`gg3j0${visual}`);
                await expect
                    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
                    .toBe(visual === "V" ? "Hidden needle" : "H");
                await expect(editor).toHaveAttribute("data-neovim-mode", visual === "V" ? "visual-line" : "visual");
                if (collapse === "all") {
                    await page
                        .getByRole("complementary", { name: "Context", exact: true })
                        .getByRole("button", { name: "Collapse all", exact: true })
                        .click();
                } else await page.getByRole("button", { name: "Collapse Parent", exact: true }).click();
                await expect(editor).toHaveAttribute("data-neovim-mode", "normal");
                await expect(editor.getByText("Hidden needle", { exact: true })).toBeHidden();
                await editor.focus();
                await page.keyboard.type(operator);
                await expect(editor.getByText("Hidden needle", { exact: true })).toHaveCount(1);
                await expect(editor.getByText("Parent body", { exact: true })).toHaveCount(1);
                await expect(editor.getByText("Deep body", { exact: true })).toHaveCount(1);
                await expect(editor.getByText("Visible body", { exact: true })).toHaveCount(1);
                await expect(editor.locator('input[type="checkbox"]')).toHaveCount(1);
            });
        }
    }
}

test("preserves a later-chunk fold during real worker history restore and remount", async ({ cleanPage: page }) => {
    test.setTimeout(120_000);
    await goHome(page);
    const url = await createNote(page, "Chunked folding history");
    const body = Array.from({ length: 280 }, (_, i) => `Paragraph ${i} ${"body text ".repeat(22)}\n\n`).join("");
    const original = `# Parent\n\nOriginal intro\n\n${body}## Child\n\nHidden later chunk\n\n# Next\n\nVisible end`;
    const restored = original.replace("Original intro", "Restored intro");
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    await page.getByRole("textbox", { name: "Markdown note editor", exact: true }).fill(original);
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", { timeout: 15_000 });
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(page.getByRole("button", { name: "Collapse Child", exact: true })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByRole("status", { name: "Note save status" })).toHaveText("Saved", { timeout: 15_000 });
    await page.getByRole("button", { name: "Collapse Child", exact: true }).click();
    const stored = await page.evaluate(
        (id) => localStorage.getItem(`writeme:collapsed-headings:${id}`),
        url.split("/").pop()!,
    );
    expect(stored).toContain("Child");
    await page.evaluate(
        async ({ id, content }) => {
            const load = (path: string) => import(new URL(path, location.origin).href);
            const { db } = await load("/packages/editor/src/store/repositories/browser/dexie-db.ts");
            const { editorGlobalRef } = await load("/packages/editor/src/app/editor-global-ref.tsx");
            const { getMarkdownWorker } = await load("/packages/editor/src/lib/markdown-worker/index.ts");
            await db.noteHistory.add({
                id: "later-chunk-restore",
                noteId: id,
                content,
                createdAt: new Date(Date.now() + 10_000),
            });
            const evidence = { chunks: 0, partialStored: [] as (string | null)[], complete: false };
            Reflect.set(window, "foldRefreshEvidence", evidence);
            getMarkdownWorker().addEventListener("message", (event: MessageEvent) => {
                if (event.data.type === "chunk") evidence.chunks++;
            });
            let loading = false;
            editorGlobalRef.current.on(
                "transaction",
                ({ transaction }: { transaction: { docChanged: boolean; getMeta: (key: string) => unknown } }) => {
                    const phase = transaction.getMeta("writeme:content-load");
                    if (phase === "start") loading = true;
                    if (loading && transaction.docChanged)
                        evidence.partialStored.push(localStorage.getItem(`writeme:collapsed-headings:${id}`));
                    if (phase === "finish") {
                        loading = false;
                        evidence.complete = true;
                    }
                },
            );
        },
        { id: url.split("/").pop()!, content: restored },
    );
    await page.getByRole("button", { name: "History", exact: true }).click();
    const history = page.getByRole("dialog", { name: "Note history", exact: true });
    const preview = history.getByRole("region", { name: "Saved version preview", exact: true });
    await expect(preview).toContainText("Restored intro");
    await preview.getByRole("button", { name: "Restore", exact: true }).click();
    await history
        .getByRole("group", { name: "Restore confirmation", exact: true })
        .getByRole("button", { name: "Restore", exact: true })
        .click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "foldRefreshEvidence").complete)).toBe(true);
    const evidence = await page.evaluate(() => Reflect.get(window, "foldRefreshEvidence"));
    expect(evidence.chunks).toBeGreaterThan(1);
    expect(evidence.partialStored.length).toBeGreaterThan(1);
    expect(evidence.partialStored.every((value: string | null) => value === stored)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("Restored intro");
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
    await expect(page.locator(".ProseMirror").getByText("Hidden later chunk", { exact: true })).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand Child", exact: true })).toBeVisible();
    await expect(page.locator(".ProseMirror").getByText("Hidden later chunk", { exact: true })).toBeHidden();
    expect(
        await page.evaluate((id) => localStorage.getItem(`writeme:collapsed-headings:${id}`), url.split("/").pop()!),
    ).toBe(stored);
});
