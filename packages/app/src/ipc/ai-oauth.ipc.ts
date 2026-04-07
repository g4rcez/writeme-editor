import { BrowserWindow, ipcMain, shell } from "electron";

export function registerAIOAuthHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle("ai:oauth-start", async (_event, authUrl: string) => {
    await shell.openExternal(authUrl);
  });
}
