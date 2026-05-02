import { startOfDay } from "date-fns";
import { BrowserWindow, screen } from "electron";
import path from "node:path";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let quickNoteWindow: BrowserWindow | null = null;
let mathNoteWindow: BrowserWindow | null = null;

function createFloatingPanel(
  preloadPath: string,
  title: string,
  hash: string,
  onClosed: () => void,
): BrowserWindow {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const windowWidth = 620;
  const windowHeight = 480;
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((workAreaSize.width - windowWidth) / 2),
    y: Math.round((workAreaSize.height - windowHeight) / 2),
    frame: false,
    show: false,
    transparent: true,
    hasShadow: true,
    roundedCorners: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    alwaysOnTop: true,
    skipTaskbar: true,
    title,
    type: "panel",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: true,
      accessibleTitle: title,
    },
  });
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const url = hash;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${url}`);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: url },
    );
  }

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  win.on("blur", () => win.hide());
  win.on("closed", onClosed);
  return win;
}

export const createQuickNoteWindow = (preloadPath: string) => {
  if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
    quickNoteWindow.show();
    quickNoteWindow.focus();
    return;
  }
  quickNoteWindow = createFloatingPanel(
    preloadPath,
    "Quick Note",
    "quicknote",
    () => {
      quickNoteWindow = null;
    },
  );
};

export const createMathNoteWindow = (preloadPath: string) => {
  if (mathNoteWindow && !mathNoteWindow.isDestroyed()) {
    mathNoteWindow.show();
    mathNoteWindow.focus();
    return;
  }
  mathNoteWindow = createFloatingPanel(
    preloadPath,
    "Math Note",
    "mathnote",
    () => {
      mathNoteWindow = null;
    },
  );
};
