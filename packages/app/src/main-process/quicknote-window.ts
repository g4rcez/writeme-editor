import { startOfDay } from "date-fns";
import { BrowserWindow, screen } from "electron";
import path from "node:path";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let quickNoteWindow: BrowserWindow | null = null;

export const createQuickNoteWindow = (preloadPath: string) => {
  if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
    quickNoteWindow.show();
    quickNoteWindow.focus();
    return;
  }
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  quickNoteWindow = new BrowserWindow({
    width: 600,
    frame: true,
    height: 450,
    show: true,
    alwaysOnTop: true,
    title: "Quick notes",
    x: width - 620,
    y: height - 470,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: true,
      accessibleTitle: "Quick notes",
    },
  });
  quickNoteWindow.setAlwaysOnTop(true, "floating");
  quickNoteWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const hash = "quicknote";
  const search = new URLSearchParams([
    ["date", startOfDay(new Date().toISOString()).toISOString()],
  ]).toString();
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    quickNoteWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${hash}?${search}`,
    );
  } else {
    quickNoteWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash, search: search },
    );
  }
  quickNoteWindow.once("ready-to-show", () => {
    quickNoteWindow?.show();
    quickNoteWindow?.focus();
  });
  quickNoteWindow.on("closed", () => {
    quickNoteWindow = null;
  });
};
