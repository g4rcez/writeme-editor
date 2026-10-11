import { expect, test } from "@playwright/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("compiled store Electron excludes privileged APIs and rejects direct IPC calls", async ({ playwright }) => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-store-profile-"));
    const buildRoot = path.resolve("artifacts/build-profiles/macos-app-store");
    const manifest = JSON.parse(await readFile(path.join(buildRoot, "build/writeme-build-main.json"), "utf8"));
    expect(manifest.channel).toBe("app-store");
    expect(manifest.excludedModules).toContain("packages/editor/src/ipc/terminal.ipc.ts");
    expect(manifest.excludedModules).toContain("packages/editor/src/main-process/app-updater.ts");
    const bootstrap = path.join(directory, "bootstrap.cjs");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");
app.setPath("appData", ${JSON.stringify(directory)});
app.setPath("userData", ${JSON.stringify(directory)});
require(${JSON.stringify(path.join(buildRoot, "build/main.js"))});`,
    );
    const application = await playwright._electron.launch({
        args: [bootstrap, "--no-sandbox"],
        env: { ...process.env, NODE_ENV: "production", WRITEME_ENABLE_FEATURES: "terminal,ai,cli" },
    });
    try {
        const page = await application.firstWindow();
        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
        expect(
            await page.evaluate(() => ({
                terminal: typeof window.electronAPI.terminal,
                execution: typeof window.electronAPI.execution,
                ai: typeof window.electronAPI.ai,
                git: typeof window.electronAPI.git,
                cli: typeof window.electronAPI.app.installCli,
            })),
        ).toEqual({
            terminal: "undefined",
            execution: "undefined",
            ai: "undefined",
            git: "undefined",
            cli: "undefined",
        });
        const state = await application.evaluate(({ BrowserWindow, Menu, ipcMain }) => {
            const labels: string[] = [];
            function visit(menu: Electron.Menu | null): void {
                for (const item of menu?.items ?? []) {
                    labels.push(item.label);
                    if (item.submenu) visit(item.submenu);
                }
            }
            visit(Menu.getApplicationMenu());
            return {
                labels,
                windows: BrowserWindow.getAllWindows().length,
                terminalListeners: ipcMain.listenerCount("terminal:spawn"),
                queryListeners: ipcMain.listenerCount("ai:query"),
            };
        });
        expect(state.labels).not.toContain("Install CLI");
        expect(state.labels).not.toContain("AI");
        expect(state.terminalListeners).toBe(0);
        expect(state.queryListeners).toBe(0);
        const rejected = await application.evaluate(async ({ BrowserWindow }) => {
            const window = new BrowserWindow({
                show: false,
                webPreferences: { nodeIntegration: true, contextIsolation: false },
            });
            await window.loadURL("about:blank");
            try {
                return await window.webContents.executeJavaScript(
                    `Promise.all(["execution:run", "execution:resolve", "app:install-cli", "git:status", "ai:get-proxy-token"].map(async channel => { try { await require("electron").ipcRenderer.invoke(channel, "echo blocked", [], ""); return false; } catch { return true; } }))`,
                );
            } finally {
                window.destroy();
            }
        });
        expect(rejected).toEqual([true, true, true, true, true]);
        await page.goto(`${page.url().split("#")[0]}#/chat`);
        await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
