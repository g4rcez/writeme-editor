import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  shell,
  Tray,
  ipcMain,
  protocol,
  net,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { notesIpcHandler } from "./ipc/notes.ipc";
import { databaseIpcHandler } from "./ipc/database.ipc";
import { appIpcHandler } from "./ipc/app.ipc";
import { executionIpcHandler } from "./ipc/execution.ipc";
import { handleWindowClose } from "./main-process/window-lifecycle";
import { createQuickNoteWindow } from "./main-process/quicknote-window";
import { AIRunner } from "./main-process/ai-runner";
import { dbManager } from "./main-process/database";
import { FileWatcher } from "./main-process/file-watcher";

function registerAIHandlers() {
  console.log("Registering AI IPC handlers...");
  ipcMain.on(
    "ai:query",
    async (
      event,
      { commandTemplate, prompt, selection, context, systemPrompt },
    ) => {
      console.log("AI Query received", { prompt });
      AIRunner.run(
        commandTemplate,
        { prompt, selection, context, systemPrompt },
        event.sender,
      );
    },
  );

  ipcMain.on("ai:stop", () => AIRunner.stop());

  ipcMain.handle("ai:get-configs", () => {
    try {
      return dbManager().getAll("aiConfigs");
    } catch (e) {
      console.error("Error in ai:get-configs handler:", e);
      return [];
    }
  });

  ipcMain.handle("ai:test", () => {
    return "ok";
  });

  ipcMain.handle("ai:save-config", (_, config) => {
    try {
      dbManager().save("aiConfigs", {
        ...config,
        type: "aiConfig",
      });
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:save-config:", e);
      throw e;
    }
  });

  ipcMain.handle("ai:delete-config", (_, id) => {
    try {
      dbManager().delete("aiConfigs", id);
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:delete-config:", e);
      throw e;
    }
  });

  ipcMain.handle("ai:get-chats", (_, noteId) => {
    try {
      const db = dbManager();
      const stmt = db.db.prepare(
        "SELECT * FROM aiChats WHERE noteId = ? ORDER BY createdAt DESC",
      );
      const results = stmt.all(noteId);
      return results.map((r) => db.normalizeRow(r));
    } catch (e: any) {
      console.error("Error in ai:get-chats:", e);
      return [];
    }
  });

  ipcMain.handle("ai:save-chat", (_, chat) => {
    try {
      dbManager().save("aiChats", {
        ...chat,
        type: "aiChat",
      });
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:save-chat:", e);
      throw e;
    }
  });

  ipcMain.handle("ai:get-messages", (_, chatId) => {
    try {
      const db = dbManager();
      const stmt = db.db.prepare(
        "SELECT * FROM aiMessages WHERE chatId = ? ORDER BY createdAt ASC",
      );
      const results = stmt.all(chatId);
      // @ts-ignore
      return results.map((r) => db.normalizeRow(r));
    } catch (e: any) {
      console.error("Error in ai:get-messages:", e);
      return [];
    }
  });

  ipcMain.handle("ai:save-message", (_, message) => {
    try {
      dbManager().save("aiMessages", {
        ...message,
        type: "aiMessage",
      });
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:save-message:", e);
      throw e;
    }
  });
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

async function main() {
  if (started) {
    app.quit();
  }
  const preload = path.join(__dirname, "preload.js");
  console.log("Main process starting, registering AI handlers...");
  registerAIHandlers();
  await notesIpcHandler();
  databaseIpcHandler();
  appIpcHandler(preload);
  executionIpcHandler();
  ipcMain.handle("fs:watcher:start", (_, directory: string) => {
    if (mainWindow) FileWatcher.start(directory, mainWindow);
  });

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
    protocol.handle("writeme", (request) => {
      const url = request.url;
      if (url.startsWith("writeme://action@image/")) {
        const filePath = decodeURIComponent(
          url.slice("writeme://action@image/".length),
        );
        return net.fetch("file://" + filePath);
      }
      return new Response("Not Found", { status: 404 });
    });

    createWindow();
    createTray();
    globalShortcut.register("CommandOrControl+Alt+N", () =>
      createQuickNoteWindow(preload),
    );

    if (mainWindow) {
      try {
        const settings = dbManager().getAll<{ name: string; value: string }>("settings");
        const dirSetting = settings.find((s) => s.name === "directory");
        if (dirSetting?.value) {
          const directory = JSON.parse(dirSetting.value);
          if (typeof directory === "string" && directory) {
            FileWatcher.start(directory, mainWindow);
          }
        }
      } catch (e) {
        console.error("Failed to start file watcher on ready:", e);
      }
    }
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
