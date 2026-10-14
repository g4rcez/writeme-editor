import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setCodeMarkdown, waitForCodeSave } from "../helpers/code-results";

test("keeps real shell stdout and stderr across compiled Electron reload", async ({ playwright }) => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-code-results-"));
    const workspace = path.join(directory, "notes");
    await mkdir(workspace);
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const root = path.resolve(process.env.WRITEME_CODE_RESULTS_BUILD_ROOT ?? ".vite");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");
app.setPath("appData", ${JSON.stringify(directory)});
app.setPath("userData", ${JSON.stringify(directory)});
require(${JSON.stringify(path.join(root, "build/main.js"))});`,
    );
    const application = await playwright._electron.launch({
        args: [bootstrap, "--no-sandbox"],
        env: { ...process.env, NODE_ENV: "production" },
    });
    try {
        const page = await application.firstWindow();
        const window = await application.browserWindow(page);
        await window.evaluate((window) => window.setSize(1440, 1000));
        await page.setViewportSize({ width: 1440, height: 1000 });
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page.evaluate(async (directory) => {
            await window.electronAPI.db.save("settings", {
                id: "directory",
                name: "directory",
                value: JSON.stringify(directory),
                type: "setting",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }, workspace);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        const title = dialog.getByTitle("Note title");
        await title.click();
        await title.pressSequentially("Native experiment");
        await page.locator('form button[type="submit"]').click();
        await expect(dialog).toBeHidden();
        await setCodeMarkdown(page, '```bash\nprintf "native stdout"; printf "native stderr" >&2\n```');
        const block = page.locator(".node-codeBlock").first();
        await expect(block.getByRole("button", { name: "Run", exact: true })).toBeVisible();
        await block.getByRole("button", { name: "Run", exact: true }).click();
        await expect(block.getByRole("region", { name: "Execution output" })).toContainText("native stdout");
        await expect(block.getByRole("region", { name: "Execution output" })).toContainText("native stderr");
        await block.getByRole("button", { name: "Keep result", exact: true }).click();
        await waitForCodeSave(page);
        await page.reload();
        await expect(block.getByRole("region", { name: "Kept code result" })).toContainText("native stdout");
        await expect(block.getByRole("region", { name: "Kept code result" })).toContainText("native stderr");
        const filename = (await readdir(workspace)).find((name) => name.endsWith(".md"));
        expect(filename).toBeDefined();
        const exported = await readFile(path.join(workspace, filename!), "utf8");
        expect(exported).toContain("<!-- writeme-code-result:v1:");
        expect(exported).toContain('printf "native stdout"');
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
