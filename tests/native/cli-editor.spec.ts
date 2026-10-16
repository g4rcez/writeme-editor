import { expect, test, type ElectronApplication } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("CLI wait mode saves prompt edits to the source file and releases on tab close", async ({
    playwright,
}, testInfo) => {
    test.setTimeout(120_000);
    const home = await mkdtemp(path.join(process.platform === "darwin" ? "/tmp" : tmpdir(), "w-"));
    const appData =
        process.platform === "darwin"
            ? path.join(home, "Library", "Application Support")
            : process.platform === "win32"
              ? path.join(home, "AppData", "Roaming")
              : path.join(home, ".config");
    const userData = path.join(appData, "writeme-dev");
    const bootstrap = path.join(home, "bootstrap.cjs");
    const promptFile = path.join(home, "claude-prompt.md");
    const cliPath = path.resolve("packages/cli/dist", process.platform === "win32" ? "writeme.exe" : "writeme");
    const entry = path.resolve(".vite/build/main.js");
    const videoDirectory = testInfo.outputPath("videos");
    let application: ElectronApplication | undefined;
    let cliProcess: ChildProcess | undefined;
    let cliExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;
    const rendererErrors: string[] = [];

    try {
        await mkdir(userData, { recursive: true });
        await mkdir(videoDirectory, { recursive: true });
        if (process.platform !== "win32") await symlink("writeme-dev", path.join(appData, "writeme"));
        await writeFile(promptFile, "Original prompt text.\n", "utf8");
        await writeFile(
            bootstrap,
            `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(appData)});\napp.setPath("userData", ${JSON.stringify(userData)});\nrequire(${JSON.stringify(entry)});\n`,
        );

        application = await playwright._electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: {
                ...process.env,
                HOME: home,
                USERPROFILE: home,
                APPDATA: path.join(home, "AppData", "Roaming"),
                LOCALAPPDATA: path.join(home, "AppData", "Local"),
                XDG_CONFIG_HOME: path.join(home, ".config"),
                NODE_ENV: "production",
            },
            recordVideo: { dir: videoDirectory, size: { width: 1280, height: 800 } },
        });
        const page = await application.firstWindow();
        page.on("console", (message) => {
            if (message.type() === "error") rendererErrors.push(message.text());
        });
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        expect(await application.evaluate(({ app }) => app.getPath("userData"))).toBe(userData);
        if (process.platform !== "win32") {
            const socketPath = path.join(userData, "writeme.sock");
            await expect.poll(() => existsSync(socketPath), { timeout: 30_000 }).toBe(true);
        }

        cliProcess = spawn(cliPath, ["--wait", promptFile], {
            env: {
                ...process.env,
                HOME: home,
                USERPROFILE: home,
                APPDATA: path.join(home, "AppData", "Roaming"),
                LOCALAPPDATA: path.join(home, "AppData", "Local"),
                XDG_CONFIG_HOME: path.join(home, ".config"),
            },
            stdio: "ignore",
        });
        cliExit = new Promise((resolve) => {
            cliProcess?.once("error", () => resolve({ code: 1, signal: null }));
            cliProcess?.once("exit", (code, signal) => resolve({ code, signal }));
        });

        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await expect(editor).toContainText("Original prompt text.", { timeout: 30_000 });
        await editor.fill("Updated prompt from Writeme.");
        await editor.press("ControlOrMeta+s");
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await expect.poll(() => readFile(promptFile, "utf8")).toContain("Updated prompt from Writeme.");
        await page.waitForTimeout(5_500);
        expect(cliProcess.exitCode).toBeNull();

        const screenshot = testInfo.outputPath("cli-editor-prompt.png");
        await page.screenshot({ path: screenshot });
        await testInfo.attach("Writeme prompt editor", { path: screenshot, contentType: "image/png" });
        expect(await page.evaluate((filePath) => window.electronAPI.app.isCliEditorFile(filePath), promptFile)).toBe(
            true,
        );

        await page.getByRole("button", { name: "Close claude-prompt", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        if (!cliExit) throw new Error("The CLI wait process was not started.");
        await expect.poll(() => cliExit).toEqual({ code: 0, signal: null });
        await expect
            .poll(() => page.evaluate((filePath) => window.electronAPI.app.isCliEditorFile(filePath), promptFile))
            .toBe(false);
        expect(await readFile(promptFile, "utf8")).toBe("Updated prompt from Writeme.");
        const unauthorizedWrite = await page.evaluate(
            (filePath) => window.electronAPI.fs.writeFile(filePath, "Unauthorized after editor close."),
            promptFile,
        );
        expect(unauthorizedWrite.success).toBe(false);
        expect(await readFile(promptFile, "utf8")).toBe("Updated prompt from Writeme.");
    } finally {
        if (cliProcess && cliProcess.exitCode === null) cliProcess.kill();
        await application?.close();
        for (const filename of await readdir(videoDirectory)) {
            if (filename.endsWith(".webm")) {
                await testInfo.attach("CLI editor session", {
                    path: path.join(videoDirectory, filename),
                    contentType: "video/webm",
                });
            }
        }
        await rm(home, { recursive: true, force: true });
    }
});
