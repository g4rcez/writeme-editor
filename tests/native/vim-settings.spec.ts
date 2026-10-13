import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("Save Vim persists init.ts in compiled Electron", async ({ playwright }) => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-vim-native-"));
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const root = path.resolve(process.env.WRITEME_VIM_BUILD_ROOT ?? ".vite");
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
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page.evaluate(() => {
            window.location.hash = "/settings/vim";
        });
        const source = page.getByRole("textbox", { name: "Global init.ts" });
        const init = 'vim.keymap.set("insert", "jk", "<Esc>");';
        await source.fill(init);
        await page.getByRole("button", { name: "Save Vim", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("Vim settings saved for all editors.");
        const stored = await page.evaluate(async () => {
            const settings = await window.electronAPI.db.getAll<{ name: string; value: string }>("settings");
            return settings.find((setting) => setting.name === "vimConfig")?.value;
        });
        expect(stored).toBe(JSON.stringify(init));
        await page.reload();
        await expect(source).toHaveText(init, { useInnerText: true });
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
