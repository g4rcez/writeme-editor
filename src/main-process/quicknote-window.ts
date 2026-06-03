import { BrowserWindow, screen } from "electron";
import path from "node:path";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let quickNoteWindow: BrowserWindow | null = null;
let mathNoteWindow: BrowserWindow | null = null;

const floatingPanelWidth = 620;
const floatingPanelHeight = 480;

type FloatingPanelBounds = {
  width: number;
  height: number;
  x: number;
  y: number;
};

function getFloatingPanelBounds(): FloatingPanelBounds {
  const point = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(point);

  return {
    width: floatingPanelWidth,
    height: floatingPanelHeight,
    x: workArea.x + Math.round((workArea.width - floatingPanelWidth) / 2),
    y: workArea.y + Math.round((workArea.height - floatingPanelHeight) / 2),
  };
}

function showFloatingPanel(win: BrowserWindow): void {
  win.setBounds(getFloatingPanelBounds(), false);
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.moveTop();
  win.show();
  win.focus();
}

function createFloatingPanel(
  preloadPath: string,
  title: string,
  hash: string,
  onClosed: () => void,
): BrowserWindow {
  const bounds = getFloatingPanelBounds();
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
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
    showFloatingPanel(win);
  });
  win.on("blur", () => win.hide());
  win.on("closed", onClosed);
  return win;
}

export const createQuickNoteWindow = (preloadPath: string) => {
  if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
    showFloatingPanel(quickNoteWindow);
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
    showFloatingPanel(mathNoteWindow);
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
