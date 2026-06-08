import { app, BrowserWindow, screen } from "electron";
import fs from "node:fs";
import path from "node:path";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const quickNoteWindows = new Set<BrowserWindow>();
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

const floatingPanelTopLevel: NonNullable<
  Parameters<BrowserWindow["setAlwaysOnTop"]>[1]
> = process.platform === "darwin" ? "screen-saver" : "floating";

type FloatingPanelOptions = {
  hideOnBlur?: boolean;
  nativeWindowControls?: boolean;
  persistBounds?: boolean;
  resizable?: boolean;
};

function getQuickNoteBoundsPath(): string {
  return path.join(app.getPath("userData"), "quicknote-window-bounds.json");
}

function isFloatingPanelBounds(value: unknown): value is FloatingPanelBounds {
  if (!value || typeof value !== "object") return false;
  const bounds = value as Partial<Record<keyof FloatingPanelBounds, unknown>>;
  return [bounds.width, bounds.height, bounds.x, bounds.y].every(
    (part) => typeof part === "number" && Number.isFinite(part),
  );
}

function loadQuickNoteBounds(): FloatingPanelBounds | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(getQuickNoteBoundsPath(), "utf8"),
    );
    return isFloatingPanelBounds(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveQuickNoteBounds(win: BrowserWindow): void {
  try {
    fs.writeFileSync(
      getQuickNoteBoundsPath(),
      JSON.stringify(win.getBounds(), null, 2),
      "utf8",
    );
  } catch (error) {
    console.warn("Failed to save quick note window bounds:", error);
  }
}

function getInitialPanelBounds(
  options: FloatingPanelOptions,
): FloatingPanelBounds {
  return options.persistBounds
    ? (loadQuickNoteBounds() ?? getFloatingPanelBounds())
    : getFloatingPanelBounds();
}

function showFloatingPanel(
  win: BrowserWindow,
  options: FloatingPanelOptions = {},
): void {
  const isResizable = options.resizable === true;
  win.setBounds(getInitialPanelBounds(options), false);
  win.setFocusable(true);
  win.setMovable(true);
  win.setResizable(isResizable);
  win.setMaximizable(false);
  win.setMinimizable(false);
  win.setFullScreenable(false);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, floatingPanelTopLevel);
  win.show();
  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }
  win.moveTop();
  win.focus();
  win.webContents.focus();
}

function createFloatingPanel(
  preloadPath: string,
  title: string,
  hash: string,
  onClosed: () => void,
  options: FloatingPanelOptions = {},
): BrowserWindow {
  const bounds = getInitialPanelBounds(options);
  const nativeWindowControls = options.nativeWindowControls === true;
  const isResizable = options.resizable === true;
  const win = new BrowserWindow({
    title,
    show: false,
    x: bounds.x,
    y: bounds.y,
    ...(nativeWindowControls
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 16, y: 16 },
        }
      : { frame: false }),
    type: "panel",
    focusable: true,
    movable: true,
    hasShadow: true,
    resizable: isResizable,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    maximizable: false,
    minimizable: false,
    width: bounds.width,
    roundedCorners: true,
    fullscreenable: false,
    height: bounds.height,
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: true,
      accessibleTitle: title,
    },
  });
  win.setFocusable(true);
  win.setMovable(true);
  win.setResizable(isResizable);
  win.setMaximizable(false);
  win.setMinimizable(false);
  win.setFullScreenable(false);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, floatingPanelTopLevel);
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
    showFloatingPanel(win, options);
  });
  if (options.hideOnBlur) {
    win.on("blur", () => win.hide());
  }
  if (options.persistBounds) {
    win.on("close", () => saveQuickNoteBounds(win));
  }
  win.on("closed", onClosed);
  return win;
}

export const createQuickNoteWindow = (preloadPath: string) => {
  const quickNoteWindow = createFloatingPanel(
    preloadPath,
    "Quick Note",
    "quicknote",
    () => {
      quickNoteWindows.delete(quickNoteWindow);
    },
    { nativeWindowControls: true, persistBounds: true, resizable: true },
  );
  quickNoteWindows.add(quickNoteWindow);
};

export const createMathNoteWindow = (preloadPath: string) => {
  if (mathNoteWindow && !mathNoteWindow.isDestroyed()) {
    showFloatingPanel(mathNoteWindow, { resizable: false });
    return;
  }
  mathNoteWindow = createFloatingPanel(
    preloadPath,
    "Math Note",
    "mathnote",
    () => {
      mathNoteWindow = null;
    },
    { hideOnBlur: true },
  );
};
