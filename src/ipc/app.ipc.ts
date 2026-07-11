import { app, BrowserWindow, ipcMain, nativeTheme, systemPreferences } from "electron";
import { installBundledCli } from "../main-process/cli-installer";
import { markCliRendererReady } from "../main-process/cli-server";
import { createQuickNoteWindow } from "../main-process/quicknote-window";

const getSystemAccentColor = (): string | null => {
    try {
        return systemPreferences.getAccentColor();
    } catch {
        return null;
    }
};

const emitSystemAccentColor = (color = getSystemAccentColor()): void => {
    if (!color) return;
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("app:system-accent-color-changed", color);
    });
};

let isSystemAccentListenerRegistered = false;

const registerSystemAccentListener = (): void => {
    if (isSystemAccentListenerRegistered) return;
    isSystemAccentListenerRegistered = true;

    systemPreferences.on("accent-color-changed", (_, color) => {
        emitSystemAccentColor(color);
    });
    nativeTheme.on("updated", () => emitSystemAccentColor());
};

export const appIpcHandler = (
    preloadPath: string,
    getLaunchWorkspacePath: () => string | null,
    setLaunchWorkspacePath: (workspacePath: string | null) => void,
) => {
    registerSystemAccentListener();
    ipcMain.handle("env:getHome", () => app.getPath("home"));
    ipcMain.handle("app:openQuickNote", () => createQuickNoteWindow(preloadPath));
    ipcMain.handle("app:hideToTray", (event) => {
        BrowserWindow.fromWebContents(event.sender)?.hide();
        return true;
    });
    ipcMain.handle("app:get-system-accent-color", () => getSystemAccentColor());
    ipcMain.handle("app:get-launch-workspace", () => getLaunchWorkspacePath());
    ipcMain.handle("app:set-launch-workspace", (_, workspacePath: string | null) => {
        setLaunchWorkspacePath(workspacePath);
        return true;
    });
    ipcMain.handle("app:renderer-ready", (event, workspacePath: string | null = null) => {
        setLaunchWorkspacePath(workspacePath);
        markCliRendererReady(event.sender, workspacePath);
        return true;
    });
    ipcMain.handle("app:install-cli", async () => {
        try {
            const result = await installBundledCli({ appPath: app.getAppPath() });
            return { success: true, ...result };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    });
    ipcMain.handle("app:chdir", (_, dir: string) => {
        try {
            process.chdir(dir);
            return { success: true };
        } catch (e: any) {
            console.error(`Failed to change directory to ${dir}:`, e);
            return { success: false, error: e.message };
        }
    });
};
