import { app, dialog, ipcMain } from "electron";
import { createQuickNoteWindow } from "../main-process/quicknote-window";
import * as path from "node:path";

export const appIpcHandler = (preloadPath: string) => {
  ipcMain.handle("env:getHome", () => app.getPath("home"));
  ipcMain.handle("app:openQuickNote", () => createQuickNoteWindow(preloadPath));
};
