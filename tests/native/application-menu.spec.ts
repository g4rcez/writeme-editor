import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("the macOS Cmd+Q menu action quits instead of hiding its window", async ({ playwright }) => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-quit-native-"));
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const buildRoot = path.resolve(process.env.WRITEME_MENU_BUILD_ROOT ?? ".vite");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");
app.setPath("appData", ${JSON.stringify(directory)});
app.setPath("userData", ${JSON.stringify(directory)});
require(${JSON.stringify(path.join(buildRoot, "build/main.js"))});`,
    );
    const application = await playwright._electron.launch({
        args: [bootstrap, "--no-sandbox"],
        env: { ...process.env, NODE_ENV: "production" },
    });
    const appProcess = application.process();
    let exited = false;
    application.on("close", () => {
        exited = true;
    });
    try {
        const page = await application.firstWindow();
        const quitItem = await application.evaluate(({ Menu }) => {
            const item = Menu.getApplicationMenu()?.items[0]?.submenu?.items.find(
                (entry) => entry.label === "Quit Writeme",
            );
            return { role: item?.role, accelerator: item?.accelerator };
        });
        expect(quitItem).toEqual({ role: "quit", accelerator: "CommandOrControl+Q" });
        await expect(page).toHaveURL(/^file:/);
        await application.evaluate(({ Menu }) => {
            setImmediate(() => Menu.sendActionToFirstResponder("terminate:"));
        });
        await expect.poll(() => exited, { timeout: 5000 }).toBe(true);
        await expect.poll(() => appProcess.exitCode).toBe(0);
    } finally {
        if (!exited) await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
