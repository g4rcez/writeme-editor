import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { notesIpcHandler } from "./ipc/notes.ipc";

async function main() {
  if (started) {
    app.quit();
  }

  await notesIpcHandler();

  ipcMain.handle("env:getHome", () => app.getPath("home"));

  const createWindow = () => {
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      center: true,
      accentColor: "#000000",
      webPreferences: {
        nodeIntegration: true,
        accessibleTitle: "writeme",
        preload: path.join(__dirname, "preload.js"),
      },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }
    mainWindow.webContents.openDevTools();
  };

  app.on("ready", createWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

main();
