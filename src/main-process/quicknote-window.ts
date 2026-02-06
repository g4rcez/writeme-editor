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
    height: 400,
    x: Math.round(width / 2 - 300),
    y: Math.round(height / 2 - 200),
    alwaysOnTop: true,
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      preload: preloadPath,
    },
  });

  const hash = "quicknote";
  
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    quickNoteWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${hash}`);
  } else {
    // In production, we load the file and add the hash
    quickNoteWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: hash }
    );
  }

  quickNoteWindow.once("ready-to-show", () => {
    quickNoteWindow?.show();
    quickNoteWindow?.focus();
    // Send event to tell React to initialize Quick Note mode
    quickNoteWindow?.webContents.send("quicknote:open");
  });

  quickNoteWindow.on("closed", () => {
    quickNoteWindow = null;
  });
};