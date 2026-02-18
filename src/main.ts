import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { notesIpcHandler } from "./ipc/notes.ipc";
import { databaseIpcHandler } from "./ipc/database.ipc";
import { appIpcHandler } from "./ipc/app.ipc";
import { executionIpcHandler } from "./ipc/execution.ipc";
import { handleWindowClose } from "./main-process/window-lifecycle";
import { createQuickNoteWindow } from "./main-process/quicknote-window";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

async function main() {
  if (started) {
    app.quit();
  }
  const preload = path.join(__dirname, "preload.js");
  await notesIpcHandler();
  databaseIpcHandler();
  appIpcHandler(preload);
  executionIpcHandler();

  const createWindow = () => {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      center: true,
      accentColor: "#000000",
      webPreferences: {
        preload,
        defaultFontSize: 16,
        nodeIntegration: true,
        contextIsolation: true,
        defaultEncoding: "utf-8",
        accessibleTitle: "Writeme",
      },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }
    if (process.env.NODE_ENV === "development") {
      mainWindow.webContents.openDevTools();
    }
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("http:") || url.startsWith("https:")) {
        shell.openExternal(url);
      }
      return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
      const requestedHost = new URL(url).host;
      if (mainWindow) {
        const currentHost = new URL(mainWindow.webContents.getURL()).host;
        if (requestedHost && requestedHost !== currentHost) {
          event.preventDefault();
          shell.openExternal(url);
        }
      }
    });
    mainWindow.on("close", (e) => {
      handleWindowClose(e, mainWindow!, isQuitting);
    });
  };

  const createTray = () => {
    const iconPath = path.join(app.getAppPath(), "public", "favicon-16x16.png");
    const icon = nativeImage
      .createFromPath(iconPath)
      .resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip("Writeme");
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show Writeme",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: "Quick note",
        click: () => createQuickNoteWindow(path.join(__dirname, "preload.js")),
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);
    if (process.platform !== "darwin") {
      tray.on("click", () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
      });
    }
  };
  app.on("before-quit", () => void (isQuitting = true));
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("ready", () => {
    createWindow();
    createTray();
    globalShortcut.register("CommandOrControl+Alt+N", () =>
      createQuickNoteWindow(preload),
    );
  });
  app.on("window-all-closed", () => {});
  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

main();
