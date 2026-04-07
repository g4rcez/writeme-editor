import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  shell,
  Tray,
} from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { appIpcHandler } from "./ipc/app.ipc";
import { databaseIpcHandler } from "./ipc/database.ipc";
import { executionIpcHandler } from "./ipc/execution.ipc";
import { notesIpcHandler } from "./ipc/notes.ipc";
import { terminalIpcHandler } from "./ipc/terminal.ipc";
import { readItLaterIpcHandler } from "./ipc/read-it-later.ipc";
import { registerAIOAuthHandlers } from "./ipc/ai-oauth.ipc";
import { AIRunner } from "./main-process/ai-runner";
import { dbManager } from "./main-process/database";
import { FileWatcher } from "./main-process/file-watcher";
import { createQuickNoteWindow } from "./main-process/quicknote-window";
import { handleWindowClose } from "./main-process/window-lifecycle";
import {
  notifyFileClosed,
  startCliServer,
  stopCliServer,
} from "./main-process/cli-server";
import { startProxyServer } from "./server/proxy";

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

  ipcMain.handle("ai:clear-messages", (_, chatId: string) => {
    try {
      dbManager()
        .db.prepare("DELETE FROM aiMessages WHERE chatId = ?")
        .run(chatId);
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:clear-messages:", e);
      throw e;
    }
  });

  ipcMain.handle("ai:save-credentials", (_, creds) => {
    try {
      const now = new Date().toISOString();
      const db = dbManager().db;
      db.prepare(
        `
        INSERT OR REPLACE INTO aiCredentials
          (adapterId, accessToken, refreshToken, expiresAt, apiKey, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM aiCredentials WHERE adapterId = ?), ?), ?)
      `,
      ).run(
        creds.adapterId,
        creds.accessToken ?? null,
        creds.refreshToken ?? null,
        creds.expiresAt ?? null,
        creds.apiKey ?? null,
        creds.adapterId,
        now,
        now,
      );
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:save-credentials:", e);
      throw e;
    }
  });

  ipcMain.handle("ai:load-credentials", (_, adapterId: string) => {
    try {
      const row = dbManager()
        .db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?")
        .get(adapterId) as any;
      return row ?? null;
    } catch (e: any) {
      console.error("Error in ai:load-credentials:", e);
      return null;
    }
  });

  ipcMain.handle("ai:clear-credentials", (_, adapterId: string) => {
    try {
      dbManager()
        .db.prepare("DELETE FROM aiCredentials WHERE adapterId = ?")
        .run(adapterId);
      return { success: true };
    } catch (e: any) {
      console.error("Error in ai:clear-credentials:", e);
      throw e;
    }
  });
}

async function checkLinuxUpdate() {
  try {
    const response = await net.fetch(
      "https://api.github.com/repos/g4rcez/writeme-editor/releases/latest",
    );
    const release = (await response.json()) as {
      tag_name: string;
      html_url: string;
    };
    const latest = release.tag_name.replace(/^v/, "");
    const current = app.getVersion();
    if (latest !== current) {
      const { response: btn } = await dialog.showMessageBox({
        type: "info",
        title: "Update available",
        message: `A new version (${latest}) is available. You are running ${current}.`,
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (btn === 0) {
        shell.openExternal(release.html_url);
      }
    }
  } catch {
    // no internet or API error — silently ignore
  }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let pendingFileOpen: string | null = null;

function parseCliArgs(
  argv: string[],
  workingDir?: string,
): { filePath: string | null } {
  const startIdx = app.isPackaged ? 1 : 2;
  const args = argv.slice(startIdx);
  for (const arg of args) {
    if (!arg.startsWith("-")) {
      const resolved = workingDir
        ? path.resolve(workingDir, arg)
        : path.resolve(arg);
      return { filePath: resolved };
    }
  }
  return { filePath: null };
}

function sendOpenFile(
  filePath: string,
  wait: boolean,
  requestId: string,
): void {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send("app:open-file", { filePath, wait, requestId });
  }
}

async function main() {
  if (started) {
    app.quit();
    return;
  }

  // Single-instance lock: second invocation forwards args to first instance
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", (_, argv, workingDirectory) => {
    const { filePath } = parseCliArgs(argv, workingDirectory);
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (filePath) {
      sendOpenFile(filePath, false, crypto.randomUUID());
    }
  });

  // macOS: handle files opened via Finder / drag onto dock icon
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (mainWindow?.webContents && !mainWindow.webContents.isLoading()) {
      sendOpenFile(filePath, false, crypto.randomUUID());
    } else {
      pendingFileOpen = filePath;
    }
  });

  ipcMain.handle("app:file-closed", (_, requestId: string) => {
    notifyFileClosed(requestId);
    return true;
  });

  startProxyServer();

  const preload = path.join(__dirname, "preload.js");
  console.log("Main process starting, registering AI handlers...");
  registerAIHandlers();
  await notesIpcHandler();
  databaseIpcHandler();
  appIpcHandler(preload);
  executionIpcHandler();
  terminalIpcHandler();
  readItLaterIpcHandler();
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
  app.on("before-quit", () => {
    isQuitting = true;
    stopCliServer();
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("ready", () => {
    createWindow();
    createTray();
    if (mainWindow) registerAIOAuthHandlers(mainWindow);
    if (mainWindow) startCliServer(mainWindow);

    // Open file passed as CLI arg on fresh launch
    if (mainWindow) {
      const { filePath } = parseCliArgs(process.argv);
      const fileToOpen = filePath ?? pendingFileOpen;
      if (fileToOpen) {
        pendingFileOpen = null;
        mainWindow.webContents.once("did-finish-load", () => {
          sendOpenFile(fileToOpen, false, crypto.randomUUID());
        });
      }
    }

    if (app.isPackaged) {
      if (process.platform !== "linux") {
        updateElectronApp({
          updateSource: {
            type: UpdateSourceType.ElectronPublicUpdateService,
            repo: "g4rcez/writeme-editor",
          },
          updateInterval: "1 hour",
          notifyUser: true,
        });
      } else {
        checkLinuxUpdate();
      }
    }

    globalShortcut.register("CommandOrControl+Alt+N", () =>
      createQuickNoteWindow(preload),
    );

    if (mainWindow) {
      try {
        const settings = dbManager().getAll<{ name: string; value: string }>(
          "settings",
        );
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
