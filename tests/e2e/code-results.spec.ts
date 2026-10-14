import { setCodeMarkdown, waitForCodeSave } from "../helpers/code-results";
import { createNote, expect, goHome, test } from "./fixtures";

test.use({ serviceWorkers: "block" });

for (const { name, opener, closer, source } of [
    { name: "longer backtick closer", opener: "```", closer: "````", source: "2 + 2" },
    { name: "longer tilde closer", opener: "~~~", closer: "~~~~", source: "2 + 2" },
    { name: "empty fenced source", opener: "```", closer: "````", source: "" },
]) {
    test(`preserves sections and adjacent kept results after importing a ${name}`, async ({ cleanPage: page }) => {
        const metadata = (stdout: string): string =>
            `<!-- writeme-code-result:v1:${Buffer.from(
                JSON.stringify({
                    version: 1,
                    executedAt: "2026-10-14T12:30:00.000Z",
                    language: "javascript",
                    sourceFingerprint: "a".repeat(64),
                    stdout,
                    stderr: "",
                }),
            ).toString("base64url")} -->`;
        const markdown = [
            metadata("First kept output"),
            `${opener}javascript`,
            ...(source ? [source] : []),
            closer,
            "",
            "# Following section",
            "",
            "Following prose.",
            "",
            metadata("Second kept output"),
            "~~~javascript",
            '"second"',
            "~~~~",
            "",
            "```javascript",
            '"unsaved"',
            "```",
        ].join("\n");
        await goHome(page);
        await createNote(page, `Fence regression: ${name}`);
        await setCodeMarkdown(page, markdown);
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        const blocks = editor.locator(".node-codeBlock");
        const assertStructure = async (): Promise<void> => {
            await expect(blocks).toHaveCount(3);
            await expect(editor.getByRole("heading", { name: "Following section", exact: true })).toBeVisible();
            await expect(editor.locator("p").filter({ hasText: /^Following prose\.$/ })).toBeVisible();
            for (const [index, text] of [source, '"second"', '"unsaved"'].entries()) {
                await expect(blocks.nth(index).locator("[data-node-view-content-react]")).toHaveText(text);
            }
            await expect(blocks.nth(0).getByRole("region", { name: "Kept code result" })).toContainText(
                "First kept output",
            );
            await expect(blocks.nth(1).getByRole("region", { name: "Kept code result" })).toContainText(
                "Second kept output",
            );
            await expect(blocks.nth(2).getByRole("region", { name: "Kept code result" })).toHaveCount(0);
            await expect(editor.getByRole("region", { name: "Execution output" })).toHaveCount(0);
        };
        await assertStructure();
        const toolbar = page.getByRole("toolbar", { name: "Note tools" });
        await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
        const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
        expect((await raw.innerText()).match(/<!-- writeme-code-result:v1:/g)).toHaveLength(2);
        await expect(raw).toContainText("# Following section");
        await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
        await assertStructure();
        await waitForCodeSave(page);
        await page.reload();
        await assertStructure();
    });
}

test("retains a large kept output through worker parsing and reload", async ({ cleanPage: page }) => {
    test.setTimeout(120_000);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    let markdownWorkers = 0;
    page.on("worker", (worker) => {
        if (worker.url().includes("markdown.worker")) markdownWorkers++;
    });
    await goHome(page);
    await createNote(page, "Large result");
    await setCodeMarkdown(page, '```javascript\n"L".repeat(40000)\n```');
    const block = page.locator(".node-codeBlock").first();
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await block.getByRole("button", { name: "Keep result", exact: true }).click();
    const kept = block.getByRole("region", { name: "Kept code result" });
    await expect(kept).toContainText("L".repeat(100));
    await waitForCodeSave(page);
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await expect(raw).toContainText("writeme-code-result:v1:");
    await raw.press("ControlOrMeta+a");
    await raw.press("ControlOrMeta+c");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.length).toBeGreaterThan(50_000);
    await page.evaluate((markdown) => navigator.clipboard.writeText(`${markdown}\n\nWorker import complete`), copied);
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    await page.getByRole("textbox", { name: "Note editor", exact: true }).press("ControlOrMeta+v");
    await expect.poll(() => markdownWorkers).toBeGreaterThan(0);
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText(
        "Worker import complete",
    );
    await expect(kept).toContainText("L".repeat(100));
    await waitForCodeSave(page);
    await page.reload();
    await expect(kept).toContainText("L".repeat(100));
    await expect(kept).not.toContainText("Outdated");
});

test("keeps only explicit results, survives reload and raw mode, marks edits outdated, replaces and removes with undo", async ({
    cleanPage: page,
}, testInfo) => {
    await goHome(page);
    await createNote(page, "Code experiment");
    await setCodeMarkdown(page, '```javascript title="experiment.js"\n2 + 2\n```');
    const block = page.locator(".node-codeBlock").first();
    const result = block.getByRole("region", { name: "Kept code result" });
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await expect(block.getByRole("region", { name: "Execution output" })).toContainText("4");
    await waitForCodeSave(page);
    await page.reload();
    await expect(result).toHaveCount(0);
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await block.getByRole("button", { name: "Keep result", exact: true }).click();
    await expect(result).toContainText("4");
    await expect(result.locator("time")).toHaveAttribute("datetime", /T.*Z$/);
    await waitForCodeSave(page);
    await page.reload();
    await expect(result).toContainText("4");
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    const markdown = await raw.innerText();
    expect(markdown).toContain("<!-- writeme-code-result:v1:");
    expect(markdown).toContain('title="experiment.js"');
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(result).toContainText("4");
    const source = block.locator("[data-node-view-content-react]");
    await source.fill("3 + 3");
    await expect(source).toHaveText("3 + 3");
    await expect(result).toContainText("Outdated");
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await block.getByRole("button", { name: "Replace result", exact: true }).click();
    await expect(result).toContainText("6");
    await expect(result).not.toContainText("Outdated");
    await waitForCodeSave(page);
    const preview = page
        .locator('button[aria-current="page"]')
        .filter({ has: page.locator("h3") })
        .locator("p")
        .first();
    await expect(preview).toContainText("3 + 3");
    await expect(preview).not.toContainText("writeme-code-result");
    await page.screenshot({ path: testInfo.outputPath("kept-result.png") });
    await block.getByRole("button", { name: "Remove result", exact: true }).click();
    await expect(result).toHaveCount(0);
    await page.getByRole("textbox", { name: "Note editor", exact: true }).press("ControlOrMeta+z");
    await expect(result).toContainText("6");
    await block.getByRole("button", { name: "Remove result", exact: true }).click();
    await waitForCodeSave(page);
    await page.reload();
    await expect(result).toHaveCount(0);
});

test("moves and duplicates result/source pairs without assigning output to adjacent blocks", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    await createNote(page, "Block association");
    await setCodeMarkdown(page, '```javascript\n"first"\n```\n\n```javascript\n"second"\n```');
    const blocks = page.locator(".node-codeBlock");
    for (const index of [0, 1]) {
        await blocks.nth(index).getByRole("button", { name: "Run", exact: true }).click();
        await blocks.nth(index).getByRole("button", { name: "Keep result", exact: true }).click();
    }
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    const pairs = (await raw.innerText()).trim().split(/\n\n/);
    expect(pairs).toHaveLength(2);
    await raw.fill([pairs[1], pairs[0], pairs[1]].join("\n\n"));
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    await expect(blocks).toHaveCount(3);
    for (const [index, value] of ["second", "first", "second"].entries()) {
        await expect(blocks.nth(index).locator(".code-content-renderer")).toHaveText(`"${value}"`);
        await expect(blocks.nth(index).getByRole("region", { name: "Kept code result" })).toContainText(value);
    }
    await waitForCodeSave(page);
    await page.reload();
    await expect(blocks).toHaveCount(3);
    await blocks.last().getByRole("button", { name: "Remove result" }).click();
    await expect(blocks.first().getByRole("region", { name: "Kept code result" })).toContainText("second");
});

test("rejects oversized output and recovers by running a smaller result", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Output limit");
    await setCodeMarkdown(page, '```javascript\n"x".repeat(100001)\n```');
    const block = page.locator(".node-codeBlock").first();
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await block.getByRole("button", { name: "Keep result", exact: true }).click();
    await expect(block.getByRole("alert")).toContainText("100,000 characters");
    await expect(block.getByRole("region", { name: "Kept code result" })).toHaveCount(0);
    const source = block.locator("[data-node-view-content-react]");
    await source.fill('"recovered"');
    await expect(source).toHaveText('"recovered"');
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await block.getByRole("button", { name: "Keep result", exact: true }).click();
    await expect(block.getByRole("region", { name: "Kept code result" })).toContainText("recovered");
    await expect(block.getByRole("alert")).toHaveCount(0);
});

test("retains kept output after a storage failure and saves it when storage recovers", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Storage recovery");
    await setCodeMarkdown(page, '```javascript\n"recoverable result"\n```');
    await waitForCodeSave(page);
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        Object.assign(window, {
            restoreCodeResultStorage: () => {
                IDBObjectStore.prototype.put = original;
            },
        });
        IDBObjectStore.prototype.put = function(...args: Parameters<IDBObjectStore["put"]>) {
            if (this.name === "notes") throw new DOMException("Test disk full", "QuotaExceededError");
            return original.apply(this, args);
        };
    });
    const block = page.locator(".node-codeBlock").first();
    await block.getByRole("button", { name: "Run", exact: true }).click();
    await block.getByRole("button", { name: "Keep result", exact: true }).click();
    await page.getByRole("textbox", { name: "Note editor", exact: true }).press("Control+s");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Save failed", {
        timeout: 15_000,
    });
    await expect(block.getByRole("region", { name: "Kept code result" })).toContainText("recoverable result");
    await page.evaluate(() => {
        Reflect.get(window, "restoreCodeResultStorage")();
    });
    await waitForCodeSave(page);
    await page.reload();
    await expect(block.getByRole("region", { name: "Kept code result" })).toContainText("recoverable result");
});
