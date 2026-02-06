import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { notesIpcHandler } from "./ipc/notes.ipc";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

async function main() {
  if (started) {
    app.quit();
  }

  await notesIpcHandler();

  ipcMain.handle("env:getHome", () => app.getPath("home"));

  const createWindow = () => {
    mainWindow = new BrowserWindow({
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
        path.join(
          __dirname,
          `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
        ),
      );
    }
    mainWindow.webContents.openDevTools();

    // Hide window instead of closing (tray-resident behavior)
    mainWindow.on("close", (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow?.hide();
      }
    });
  };

  const createTray = () => {
    const iconPath = path.join(app.getAppPath(), "public", "favicon-16x16.png");
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
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
        label: "Quick Note",
        click: () => {
          openQuicknote();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);

    // On non-macOS, clicking the tray icon toggles window visibility
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

  const openQuicknote = () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("quicknote:open");
  };

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("ready", () => {
    createWindow();
    createTray();

    // Register global shortcut for quicknote
    globalShortcut.register("CommandOrControl+Alt+N", () => {
      openQuicknote();
    });
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  // App stays alive in the tray on all platforms
  app.on("window-all-closed", () => {
    // Do nothing — app stays alive in the tray
  });

  app.on("activate", () => {
    // macOS dock click: show the existing window
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

main();
