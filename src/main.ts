import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  safeStorage,
  type BrowserWindowConstructorOptions,
  type MenuItemConstructorOptions,
  type NativeImage,
  nativeImage,
  net,
  shell,
  Tray,
} from "electron";
import started from "electron-squirrel-startup";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { appIpcHandler } from "./ipc/app.ipc";
import { databaseIpcHandler } from "./ipc/database.ipc";
import { executionIpcHandler } from "./ipc/execution.ipc";
import { notesIpcHandler } from "./ipc/notes.ipc";
import { terminalIpcHandler } from "./ipc/terminal.ipc";
import { readItLaterIpcHandler } from "./ipc/read-it-later.ipc";
import { registerAIOAuthHandlers } from "./ipc/ai-oauth.ipc";
import { gitIpcHandler } from "./ipc/git.ipc";
import { AIRunner } from "./main-process/ai-runner";
import { dbManager } from "./main-process/database";
import { installBundledCli } from "./main-process/cli-installer";
import { FileWatcher } from "./main-process/file-watcher";
import {
  createMathNoteWindow,
  createQuickNoteWindow,
} from "./main-process/quicknote-window";
import { createFolderWindow } from "./main-process/folder-window";
import { handleWindowClose } from "./main-process/window-lifecycle";
import {
  notifyFileClosed,
  startCliServer,
  stopCliServer,
} from "./main-process/cli-server";
import { startProxyServer } from "./server/proxy";

const CREDENTIAL_KEYS = ["accessToken", "refreshToken", "apiKey"] as const;

function protectSecret(secret: string | null): string | null {
  if (!secret) return null;
  if (!safeStorage.isEncryptionAvailable()) return secret;
  return safeStorage.encryptString(secret).toString("base64");
}

function revealSecret(secret: string | null): string | null {
  if (!secret) return null;
  if (!safeStorage.isEncryptionAvailable()) return secret;

  try {
    return safeStorage.decryptString(Buffer.from(secret, "base64"));
  } catch {
    return secret;
  }
}

function withStoredCredentials(
  row: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  for (const key of CREDENTIAL_KEYS) {
    const value = row[key];
    if (typeof value === "string") {
      out[key] = revealSecret(value);
    }
  }
  return out;
}

function persistCredentialRow(creds: { [key: string]: unknown }) {
  const output = { ...creds } as Record<string, unknown>;
  for (const key of CREDENTIAL_KEYS) {
    const value = output[key];
    if (typeof value === "string" && value.trim()) {
      output[key] = protectSecret(value);
    }
  }
  return output;
}

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
      const stmt = noteId
        ? db.db.prepare(
            "SELECT * FROM aiChats WHERE noteId = ? ORDER BY createdAt DESC",
          )
        : db.db.prepare("SELECT * FROM aiChats ORDER BY createdAt DESC");
      const results = noteId ? stmt.all(noteId) : stmt.all();
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
      const encrypted = persistCredentialRow(creds);
      db.prepare(
        `
        INSERT OR REPLACE INTO aiCredentials
          (adapterId, accessToken, refreshToken, expiresAt, apiKey, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM aiCredentials WHERE adapterId = ?), ?), ?)
      `,
      ).run(
        creds.adapterId,
        encrypted.accessToken ?? null,
        encrypted.refreshToken ?? null,
        creds.expiresAt ?? null,
        encrypted.apiKey ?? null,
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
      return withStoredCredentials(row as Record<string, unknown>) ?? null;
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
let activeQuickNoteShortcut = "CommandOrControl+Alt+N";
let activeMathNoteShortcut = "CommandOrControl+Alt+M";

type AppCommand = "quick-note" | "math-note" | "settings";

function getLogoSvgPath(): string {
  return path.join(app.getAppPath(), "public", "logo.svg");
}

function getMacOsAppIconPath(): string {
  return path.join(app.getAppPath(), "public", "icon.icns");
}

function getWindowsTaskIconPath(): string {
  return path.join(app.getAppPath(), "public", "favicon.ico");
}

function getTrayIconPath(): string {
  return path.join(app.getAppPath(), "public", "favicon-32x32.png");
}

function createNativeAppIcon(size?: number): NativeImage {
  const resize = (icon: NativeImage): NativeImage => {
    if (!size) return icon;
    return icon.resize({ width: size, height: size });
  };

  if (process.platform === "darwin") {
    const icon = nativeImage.createFromPath(getMacOsAppIconPath());
    if (!icon.isEmpty()) return resize(icon);
  }

  try {
    const svg = fs
      .readFileSync(getLogoSvgPath(), "utf8")
      .replace(/var\(--foreground\)/g, "#000000");
    const icon = nativeImage.createFromDataURL(
      `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    );
    if (!icon.isEmpty()) return resize(icon);
  } catch (error) {
    console.warn("Failed to load logo.svg for native app icon:", error);
  }

  return nativeImage.createEmpty();
}

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getMainWindowNativeOptions(): BrowserWindowConstructorOptions {
  if (process.platform !== "darwin") return {};

  return {
    backgroundColor: "#00000000",
    titleBarStyle: "default",
    vibrancy: "under-window",
    visualEffectState: "active",
    roundedCorners: true,
  };
}

function showMainWindow(): void {
  mainWindow?.show();
  mainWindow?.focus();
}

function sendNavigate(pathname: string): void {
  if (!mainWindow) return;
  const navigate = () => mainWindow?.webContents.send("app:navigate", pathname);
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", navigate);
  } else {
    navigate();
  }
}

function openSettings(pathname: string = "/settings/quick"): void {
  showMainWindow();
  sendNavigate(pathname);
}

async function installCliFromMenu(): Promise<void> {
  try {
    const result = await installBundledCli({ appPath: app.getAppPath() });
    await dialog.showMessageBox({
      type: "info",
      title: "CLI installed",
      message: "The writeme CLI was installed successfully.",
      detail: `Installed at ${result.installPath}. Make sure ${path.dirname(
        result.installPath,
      )} is on your PATH.`,
    });
  } catch (error) {
    dialog.showErrorBox(
      "Failed to install CLI",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function parseAppCommand(argv: string[]): AppCommand | null {
  if (argv.includes("--quick-note")) return "quick-note";
  if (argv.includes("--math-note")) return "math-note";
  if (argv.includes("--settings")) return "settings";
  return null;
}

function runAppCommand(command: AppCommand, preloadPath: string): void {
  if (command === "quick-note") {
    createQuickNoteWindow(preloadPath);
    return;
  }
  if (command === "math-note") {
    createMathNoteWindow(preloadPath);
    return;
  }
  openSettings();
}

function createOsMenuTemplate(
  preloadPath: string,
): MenuItemConstructorOptions[] {
  return [
    {
      label: "Show Writeme",
      click: showMainWindow,
    },
    {
      label: "Settings",
      submenu: [
        { label: "Quick settings", click: () => openSettings() },
        {
          label: "Appearance",
          click: () => openSettings("/settings/appearance"),
        },
        { label: "Editor", click: () => openSettings("/settings/editor") },
        {
          label: "Shortcuts",
          click: () => openSettings("/settings/shortcuts"),
        },
        {
          label: "Workspace",
          click: () => openSettings("/settings/workspace"),
        },
      ],
    },
    {
      label: "Install CLI",
      click: () => {
        void installCliFromMenu();
      },
    },
    { type: "separator" },
    {
      label: "Quick note",
      click: () => createQuickNoteWindow(preloadPath),
    },
    {
      label: "Math note",
      click: () => createMathNoteWindow(preloadPath),
    },
    { type: "separator" },
    {
      label: "Quit Writeme",
      accelerator: "CommandOrControl+Shift+Q",
      click: () => app.quit(),
    },
  ];
}

function registerOsTasks(): void {
  if (process.platform !== "win32") return;
  const iconPath = getWindowsTaskIconPath();
  app.setUserTasks([
    {
      program: process.execPath,
      arguments: "--settings",
      iconPath,
      iconIndex: 0,
      title: "Quick settings",
      description: "Open Writeme quick settings.",
    },
    {
      program: process.execPath,
      arguments: "--quick-note",
      iconPath,
      iconIndex: 0,
      title: "Quick note",
      description: "Open a Writeme quick note.",
    },
    {
      program: process.execPath,
      arguments: "--math-note",
      iconPath,
      iconIndex: 0,
      title: "Math note",
      description: "Open a Writeme math note.",
    },
  ]);
}

const WORKSPACE_INSTANCE_FLAG = "--workspace-instance";
const WORKSPACE_ARG = "--workspace";
const WORKSPACE_INSTANCE_ENV = "WRITEME_WORKSPACE_INSTANCE";
const WORKSPACE_ENV = "WRITEME_WORKSPACE";

function resolveArgPath(rawPath: string, workingDir?: string): string {
  return workingDir ? path.resolve(workingDir, rawPath) : path.resolve(rawPath);
}

function getUserArgs(argv: string[]): string[] {
  const startIdx = app.isPackaged ? 1 : 2;
  return argv.slice(startIdx);
}

function isDirectoryPath(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function parseWorkspaceArg(argv: string[], workingDir?: string): string | null {
  const args = getUserArgs(argv);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === WORKSPACE_ARG) {
      const workspacePath = args[index + 1];
      return workspacePath ? resolveArgPath(workspacePath, workingDir) : null;
    }
    if (arg === WORKSPACE_INSTANCE_FLAG) continue;
    if (!arg.startsWith("-")) {
      const resolved = resolveArgPath(arg, workingDir);
      return isDirectoryPath(resolved) ? resolved : null;
    }
  }
  return null;
}

function parseCliArgs(
  argv: string[],
  workingDir?: string,
): { filePath: string | null } {
  const args = getUserArgs(argv);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === WORKSPACE_ARG) {
      index++;
      continue;
    }
    if (arg === WORKSPACE_INSTANCE_FLAG) continue;
    if (!arg.startsWith("-")) {
      return { filePath: resolveArgPath(arg, workingDir) };
    }
  }
  return { filePath: null };
}

function getAppRelaunchArgs(args: string[]): string[] {
  return app.isPackaged ? args : [app.getAppPath(), ...args];
}

function getInitialWorkspacePath(argv: string[]): string | null {
  const envWorkspace = process.env[WORKSPACE_ENV];
  return envWorkspace ? path.resolve(envWorkspace) : parseWorkspaceArg(argv);
}

function configureWorkspaceSessionData(
  workspacePath: string | null,
  isWorkspaceInstance: boolean,
): void {
  if (!workspacePath || !isWorkspaceInstance) return;

  const workspaceHash = createHash("sha256")
    .update(path.resolve(workspacePath))
    .digest("hex")
    .slice(0, 16);
  const sessionDataPath = path.join(
    app.getPath("userData"),
    "workspace-sessions",
    workspaceHash,
  );

  fs.mkdirSync(sessionDataPath, { recursive: true });
  app.setPath("sessionData", sessionDataPath);
}

function spawnWorkspaceInstance(folderPath: string): void {
  const child = spawn(
    process.execPath,
    getAppRelaunchArgs([WORKSPACE_INSTANCE_FLAG, WORKSPACE_ARG, folderPath]),
    {
      detached: true,
      env: {
        ...process.env,
        [WORKSPACE_INSTANCE_ENV]: "1",
        [WORKSPACE_ENV]: folderPath,
      },
      stdio: "ignore",
    },
  );
  child.unref();
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

  const isWorkspaceInstance =
    process.env[WORKSPACE_INSTANCE_ENV] === "1" ||
    process.argv.includes(WORKSPACE_INSTANCE_FLAG);
  let launchWorkspacePath = getInitialWorkspacePath(process.argv);
  configureWorkspaceSessionData(launchWorkspacePath, isWorkspaceInstance);

  if (!isWorkspaceInstance) {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      app.quit();
      return;
    }
  }

  app.on("second-instance", (_, argv, workingDirectory) => {
    const command = parseAppCommand(argv);
    if (command) {
      runAppCommand(command, getPreloadPath());
      return;
    }

    const workspacePath = parseWorkspaceArg(argv, workingDirectory);
    if (workspacePath) {
      if (
        launchWorkspacePath &&
        path.resolve(launchWorkspacePath) === path.resolve(workspacePath)
      ) {
        showMainWindow();
      } else {
        spawnWorkspaceInstance(workspacePath);
      }
      return;
    }

    const { filePath } = parseCliArgs(argv, workingDirectory);
    showMainWindow();
    if (filePath) {
      sendOpenFile(filePath, false, crypto.randomUUID());
    }
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (mainWindow?.webContents && !mainWindow.webContents.isLoading()) {
      sendOpenFile(filePath, false, crypto.randomUUID());
    } else {
      pendingFileOpen = filePath;
    }
  });

  if (!isWorkspaceInstance) {
    startProxyServer();
  }

  app.on("before-quit", () => {
    isQuitting = true;
    stopCliServer();
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("ready", async () => {
    const preload = getPreloadPath();
    console.log("Main process starting, registering AI handlers...");
    registerAIHandlers();
    await notesIpcHandler();
    databaseIpcHandler();
    appIpcHandler(
      preload,
      () => launchWorkspacePath,
      (workspacePath) => {
        launchWorkspacePath = workspacePath;
      },
    );
    executionIpcHandler();
    terminalIpcHandler();
    readItLaterIpcHandler();
    gitIpcHandler();
    ipcMain.handle("fs:watcher:start", (_, directory: string) => {
      if (mainWindow) FileWatcher.start(directory, mainWindow);
    });
    ipcMain.handle("app:file-closed", (_, requestId: string) => {
      notifyFileClosed(requestId);
      return true;
    });
    ipcMain.handle(
      "app:open-folder",
      (_, { folderPath }: { folderPath: string }) => {
        createFolderWindow(preload, folderPath);
        return true;
      },
    );
    ipcMain.handle("app:update-shortcut", (_, newShortcut: string) => {
      const previous = activeQuickNoteShortcut;
      globalShortcut.unregister(previous);
      const success = globalShortcut.register(newShortcut, () =>
        createQuickNoteWindow(preload),
      );
      if (!success) {
        globalShortcut.register(previous, () => createQuickNoteWindow(preload));
        return {
          success: false,
          error: `Failed to register shortcut: ${newShortcut}`,
        };
      }
      activeQuickNoteShortcut = newShortcut;
      return { success: true };
    });
    ipcMain.handle("app:update-math-shortcut", (_, newShortcut: string) => {
      const previous = activeMathNoteShortcut;
      globalShortcut.unregister(previous);
      const success = globalShortcut.register(newShortcut, () =>
        createMathNoteWindow(preload),
      );
      if (!success) {
        globalShortcut.register(previous, () => createMathNoteWindow(preload));
        return {
          success: false,
          error: `Failed to register shortcut: ${newShortcut}`,
        };
      }
      activeMathNoteShortcut = newShortcut;
      return { success: true };
    });
    const createWindow = ({ primary = true }: { primary?: boolean } = {}) => {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        center: true,
        accentColor: "#0a84ff",
        icon: createNativeAppIcon(),
        ...getMainWindowNativeOptions(),
        webPreferences: {
          preload,
          defaultFontSize: 16,
          nodeIntegration: false,
          contextIsolation: true,
          defaultEncoding: "utf-8",
          accessibleTitle: "Writeme",
        },
      });
      if (primary) {
        mainWindow = win;
      }
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      } else {
        win.loadFile(
          path.join(
            __dirname,
            `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
          ),
        );
      }
      if (process.env.NODE_ENV === "development") {
        win.webContents.openDevTools();
      }
      win.webContents.on(
        "console-message",
        (_, level, message, line, sourceId) => {
          if (level >= 2)
            console.error(`[renderer] ${sourceId}:${line} ${message}`);
        },
      );
      win.webContents.on("render-process-gone", (_, details) => {
        console.error(
          "[renderer] process gone:",
          details.reason,
          details.exitCode,
        );
      });
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("http:") || url.startsWith("https:")) {
          shell.openExternal(url);
        }
        return { action: "deny" };
      });
      win.webContents.on("will-navigate", (event, url) => {
        const requestedHost = new URL(url).host;
        const currentHost = new URL(win.webContents.getURL()).host;
        if (requestedHost && requestedHost !== currentHost) {
          event.preventDefault();
          shell.openExternal(url);
        }
      });
      if (primary && !isWorkspaceInstance) {
        win.on("close", (e) => {
          handleWindowClose(e, win, isQuitting);
        });
      }
      return win;
    };

    const createTray = () => {
      const icon = nativeImage
        .createFromPath(getTrayIconPath())
        .resize({ width: 16, height: 16 });
      if (process.platform === "darwin") icon.setTemplateImage(true);
      tray = new Tray(icon);
      tray.setToolTip("Writeme");
      tray.setContextMenu(
        Menu.buildFromTemplate(createOsMenuTemplate(preload)),
      );
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

    Menu.setApplicationMenu(null);
    if (!isWorkspaceInstance && process.platform === "darwin" && app.dock) {
      try {
        app.dock.setIcon(createNativeAppIcon());
      } catch (error) {
        console.warn("Failed to set dock icon:", error);
      }
      app.dock.setMenu(Menu.buildFromTemplate(createOsMenuTemplate(preload)));
    }
    if (!isWorkspaceInstance) {
      registerOsTasks();
    }
    createWindow();
    if (!isWorkspaceInstance) {
      createTray();
    }
    if (mainWindow) registerAIOAuthHandlers(mainWindow);
    if (mainWindow && !isWorkspaceInstance) {
      startCliServer(mainWindow, {
        getCurrentWorkspacePath: () => launchWorkspacePath,
        openWorkspaceInNewInstance: spawnWorkspaceInstance,
      });
    }

    if (mainWindow) {
      const command = parseAppCommand(process.argv);
      if (command) runAppCommand(command, preload);

      const { filePath } = launchWorkspacePath
        ? { filePath: null }
        : parseCliArgs(process.argv);
      const fileToOpen = filePath ?? pendingFileOpen;
      if (fileToOpen) {
        pendingFileOpen = null;
        mainWindow.webContents.once("did-finish-load", () => {
          sendOpenFile(fileToOpen, false, crypto.randomUUID());
        });
      }
    }

    if (!isWorkspaceInstance && app.isPackaged) {
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

    if (mainWindow && !isWorkspaceInstance) {
      try {
        const settings = dbManager().getAll<{ name: string; value: string }>(
          "settings",
        );
        const dirSetting = settings.find((s) => s.name === "directory");
        const savedDirectory = dirSetting?.value
          ? JSON.parse(dirSetting.value)
          : null;
        const directory = launchWorkspacePath ?? savedDirectory;
        if (typeof directory === "string" && directory) {
          FileWatcher.start(directory, mainWindow);
        }
        const parseSetting = (name: string, fallback: string): string => {
          const s = settings.find((x) => x.name === name);
          return s?.value ? (JSON.parse(s.value) as string) : fallback;
        };
        activeQuickNoteShortcut = parseSetting(
          "quickNoteShortcut",
          "CommandOrControl+Alt+N",
        );
        activeMathNoteShortcut = parseSetting(
          "mathNoteShortcut",
          "CommandOrControl+Alt+M",
        );
        globalShortcut.register(activeQuickNoteShortcut, () =>
          createQuickNoteWindow(preload),
        );
        globalShortcut.register(activeMathNoteShortcut, () =>
          createMathNoteWindow(preload),
        );
      } catch (e) {
        console.error("Failed to start file watcher on ready:", e);
        globalShortcut.register("CommandOrControl+Alt+N", () =>
          createQuickNoteWindow(preload),
        );
        globalShortcut.register("CommandOrControl+Alt+M", () =>
          createMathNoteWindow(preload),
        );
      }
    } else if (!isWorkspaceInstance) {
      globalShortcut.register("CommandOrControl+Alt+N", () =>
        createQuickNoteWindow(preload),
      );
      globalShortcut.register("CommandOrControl+Alt+M", () =>
        createMathNoteWindow(preload),
      );
    }
    if (!isWorkspaceInstance) {
      globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());
    }
    app.on("activate", () => {
      if (mainWindow) {
        mainWindow.show();
      } else {
        createWindow();
      }
    });
  });
  app.on("window-all-closed", () => {
    if (isWorkspaceInstance) app.quit();
  });
}

main();
