import { app, BrowserWindow, ipcMain } from "electron";
import { installBundledCli } from "../main-process/cli-installer";
import { createQuickNoteWindow } from "../main-process/quicknote-window";

export const appIpcHandler = (preloadPath: string) => {
  ipcMain.handle("env:getHome", () => app.getPath("home"));
  ipcMain.handle("app:openQuickNote", () => createQuickNoteWindow(preloadPath));
  ipcMain.handle("app:hideToTray", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide();
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
