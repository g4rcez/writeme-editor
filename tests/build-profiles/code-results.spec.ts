import { expect, test } from "@playwright/test";
import { encodeCodeResult, fingerprintCode } from "../../packages/editor/src/app/elements/code-block/code-result";
import { createNote } from "../e2e/fixtures";
import { setCodeMarkdown, waitForCodeSave } from "../helpers/code-results";

test("reads kept text results in restricted builds without executing their source or output", async ({
    page,
}, testInfo) => {
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
    await createNote(page, "Portable result");
    const source = 'window.codeResultSourceExecuted = true; "original output"';
    const result = encodeCodeResult({
        version: 1,
        executedAt: "2026-10-14T12:30:00.000Z",
        language: "javascript",
        sourceFingerprint: await fingerprintCode(source),
        stdout: "stored <script>window.codeResultOutputExecuted = true</script>",
        stderr: "stored warning",
    });
    await setCodeMarkdown(page, `<!-- writeme-code-result:v1:${result} -->\n\`\`\`javascript\n${source}\n\`\`\``);
    const kept = page.getByRole("region", { name: "Kept code result" });
    await expect(kept).toContainText("stored <script>");
    await expect(kept).toContainText("stored warning");
    await expect(kept).not.toContainText("Outdated");
    if (testInfo.project.name !== "macos-homebrew")
        await expect(page.getByRole("button", { name: "Run", exact: true })).toHaveCount(0);
    await waitForCodeSave(page);
    await page.reload();
    await expect(kept).toContainText("stored <script>");
    await expect(kept.locator("iframe, script")).toHaveCount(0);
    expect(
        await page.evaluate(() => [
            Reflect.get(window, "codeResultSourceExecuted"),
            Reflect.get(window, "codeResultOutputExecuted"),
        ]),
    ).toEqual([undefined, undefined]);
    await page.screenshot({ path: testInfo.outputPath("restricted-kept-result.png") });
});
