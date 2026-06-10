import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Point = {
  x: number;
  y: number;
};

type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FloatingPanelBounds = WorkArea;

type BrowserWindowOptions = {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  title?: string;
  frame?: boolean;
  titleBarStyle?: string;
  trafficLightPosition?: Point;
  focusable?: boolean;
  movable?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  fullscreenable?: boolean;
};

type MockWithCallOrder = {
  mock: {
    invocationCallOrder: number[];
  };
};

const createdWindows: MockBrowserWindow[] = [];

let cursorPoint: Point = { x: 1600, y: 200 };
let workArea: WorkArea = { x: 1440, y: 25, width: 1920, height: 1055 };

let persistedBoundsJson: string | null = null;
let currentWindowBounds: FloatingPanelBounds = {
  x: 210,
  y: 120,
  width: 700,
  height: 520,
};

const appMock = {
  focus: vi.fn<(options: { steal: boolean }) => void>(),
  getPath: vi.fn((_name: string) => "/user-data"),
};

const fsMock = {
  readFileSync: vi.fn((_path: string, _encoding: string) => {
    if (persistedBoundsJson === null) {
      throw new Error("missing file");
    }
    return persistedBoundsJson;
  }),
  writeFileSync: vi.fn((_path: string, data: string, _encoding: string) => {
    persistedBoundsJson = data;
  }),
};

const screenMock = {
  getCursorScreenPoint: vi.fn(() => cursorPoint),
  getDisplayNearestPoint: vi.fn(() => ({ workArea })),
};

class MockBrowserWindow {
  readonly options: BrowserWindowOptions;
  private readyToShow: (() => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private closedHandler: (() => void) | null = null;

  isDestroyed = vi.fn(() => false);
  webContents = {
    focus: vi.fn<() => void>(),
  };

  setBounds = vi.fn<(bounds: FloatingPanelBounds, animate: boolean) => void>();
  setFocusable = vi.fn<(focusable: boolean) => void>();
  setMovable = vi.fn<(movable: boolean) => void>();
  setResizable = vi.fn<(resizable: boolean) => void>();
  setMaximizable = vi.fn<(maximizable: boolean) => void>();
  setMinimizable = vi.fn<(minimizable: boolean) => void>();
  setFullScreenable = vi.fn<(fullscreenable: boolean) => void>();
  setAlwaysOnTop = vi.fn<(flag: boolean, level: string) => void>();
  setVisibleOnAllWorkspaces =
    vi.fn<
      (visible: boolean, options: { visibleOnFullScreen: boolean }) => void
    >();
  moveTop = vi.fn<() => void>();
  show = vi.fn<() => void>();
  focus = vi.fn<() => void>();
  hide = vi.fn<() => void>();
  getBounds = vi.fn<() => FloatingPanelBounds>(() => currentWindowBounds);
  loadURL = vi.fn<(url: string) => void>();
  loadFile = vi.fn<(filePath: string, options: { hash: string }) => void>();

  constructor(options: BrowserWindowOptions) {
    this.options = options;
    createdWindows.push(this);
  }

  once(eventName: string, callback: () => void): this {
    if (eventName === "ready-to-show") {
      this.readyToShow = callback;
    }

    return this;
  }

  on(eventName: string, callback: () => void): this {
    if (eventName === "close") {
      this.closeHandler = callback;
    }
    if (eventName === "closed") {
      this.closedHandler = callback;
    }

    return this;
  }

  triggerReadyToShow(): void {
    this.readyToShow?.();
  }

  triggerClose(): void {
    this.closeHandler?.();
  }

  triggerClosed(): void {
    this.closedHandler?.();
  }
}

vi.mock("electron", () => ({
  app: appMock,
  BrowserWindow: MockBrowserWindow,
  screen: screenMock,
}));

vi.mock("node:fs", () => ({
  default: fsMock,
}));

function expectedAlwaysOnTopLevel(): string {
  return process.platform === "darwin" ? "screen-saver" : "floating";
}

function expectedBoundsFor(area: WorkArea): FloatingPanelBounds {
  return {
    width: 620,
    height: 480,
    x: area.x + Math.round((area.width - 620) / 2),
    y: area.y + Math.round((area.height - 480) / 2),
  };
}

function getCreatedWindow(index: number): MockBrowserWindow {
  const win = createdWindows[index];

  if (!win) {
    throw new Error(`Expected BrowserWindow at index ${index}`);
  }

  return win;
}

function firstCallOrder(mock: MockWithCallOrder): number {
  const order = mock.mock.invocationCallOrder[0];

  if (order === undefined) {
    throw new Error("Expected mock to have been called");
  }

  return order;
}

async function importQuickNoteWindowModule(): Promise<
  typeof import("./quicknote-window")
> {
  vi.resetModules();
  vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "http://localhost:5173");
  vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "main_window");

  return import("./quicknote-window");
}

describe("quick note floating panels", () => {
  beforeEach(() => {
    createdWindows.length = 0;
    persistedBoundsJson = null;
    currentWindowBounds = { x: 210, y: 120, width: 700, height: 520 };
    cursorPoint = { x: 1600, y: 200 };
    workArea = { x: 1440, y: 25, width: 1920, height: 1055 };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates quick notes centered in the active display work area", async () => {
    const { createQuickNoteWindow } = await importQuickNoteWindowModule();
    const expectedBounds = expectedBoundsFor(workArea);

    createQuickNoteWindow("/preload.js");

    expect(createdWindows).toHaveLength(1);
    expect(getCreatedWindow(0).options).toMatchObject({
      ...expectedBounds,
      title: "Quick Note",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      focusable: true,
      movable: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
    });
    expect(screenMock.getCursorScreenPoint).toHaveBeenCalledTimes(1);
    expect(screenMock.getDisplayNearestPoint).toHaveBeenCalledWith(cursorPoint);
  });

  it("saves quick note bounds on close and restores them on next open", async () => {
    const { createQuickNoteWindow } = await importQuickNoteWindowModule();
    const savedBounds = { x: 88, y: 99, width: 760, height: 540 };

    createQuickNoteWindow("/preload.js");
    const firstWindow = getCreatedWindow(0);
    currentWindowBounds = savedBounds;
    firstWindow.triggerClose();
    firstWindow.triggerClosed();

    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      "/user-data/quicknote-window-bounds.json",
      JSON.stringify(savedBounds, null, 2),
      "utf8",
    );

    createQuickNoteWindow("/preload.js");
    const restoredWindow = getCreatedWindow(1);
    restoredWindow.triggerReadyToShow();

    expect(restoredWindow.options).toMatchObject(savedBounds);
    expect(restoredWindow.setBounds).toHaveBeenCalledWith(savedBounds, false);
  });

  it("creates a new focused and topmost quick note instance", async () => {
    const { createQuickNoteWindow } = await importQuickNoteWindowModule();

    createQuickNoteWindow("/preload.js");
    getCreatedWindow(0).triggerReadyToShow();

    workArea = { x: -1728, y: 0, width: 1728, height: 1117 };
    const expectedBounds = expectedBoundsFor(workArea);

    createQuickNoteWindow("/preload.js");
    const quickNoteWindow = getCreatedWindow(1);
    quickNoteWindow.triggerReadyToShow();

    expect(createdWindows).toHaveLength(2);
    expect(quickNoteWindow.setBounds).toHaveBeenCalledWith(
      expectedBounds,
      false,
    );
    expect(quickNoteWindow.setFocusable).toHaveBeenCalledWith(true);
    expect(quickNoteWindow.setMovable).toHaveBeenCalledWith(true);
    expect(quickNoteWindow.setResizable).toHaveBeenCalledWith(true);
    expect(quickNoteWindow.setMaximizable).toHaveBeenCalledWith(false);
    expect(quickNoteWindow.setMinimizable).toHaveBeenCalledWith(false);
    expect(quickNoteWindow.setFullScreenable).toHaveBeenCalledWith(false);
    expect(quickNoteWindow.setAlwaysOnTop).toHaveBeenCalledWith(
      true,
      expectedAlwaysOnTopLevel(),
    );
    expect(quickNoteWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(
      true,
      { visibleOnFullScreen: true },
    );
    if (process.platform === "darwin") {
      expect(appMock.focus).toHaveBeenCalledWith({ steal: true });
    }
    expect(quickNoteWindow.show).toHaveBeenCalledTimes(1);
    expect(quickNoteWindow.moveTop).toHaveBeenCalledTimes(1);
    expect(quickNoteWindow.focus).toHaveBeenCalledTimes(1);
    expect(quickNoteWindow.webContents.focus).toHaveBeenCalledTimes(1);
    expect(firstCallOrder(quickNoteWindow.setBounds)).toBeLessThan(
      firstCallOrder(quickNoteWindow.show),
    );
  });

  it("creates math scratchpads with the same floating-window behavior as quick notes", async () => {
    const { createMathNoteWindow } = await importQuickNoteWindowModule();
    const expectedBounds = expectedBoundsFor(workArea);

    createMathNoteWindow("/preload.js");
    const mathNoteWindow = getCreatedWindow(0);
    mathNoteWindow.triggerReadyToShow();

    expect(createdWindows).toHaveLength(1);
    expect(mathNoteWindow.options).toMatchObject({
      ...expectedBounds,
      title: "Math Scratchpad",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      focusable: true,
      movable: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
    });
    expect(mathNoteWindow.setBounds).toHaveBeenCalledWith(
      expectedBounds,
      false,
    );
    expect(mathNoteWindow.setFocusable).toHaveBeenCalledWith(true);
    expect(mathNoteWindow.setMovable).toHaveBeenCalledWith(true);
    expect(mathNoteWindow.setResizable).toHaveBeenCalledWith(true);
    expect(mathNoteWindow.setMaximizable).toHaveBeenCalledWith(false);
    expect(mathNoteWindow.setMinimizable).toHaveBeenCalledWith(false);
    expect(mathNoteWindow.setFullScreenable).toHaveBeenCalledWith(false);
    expect(mathNoteWindow.setAlwaysOnTop).toHaveBeenCalledWith(
      true,
      expectedAlwaysOnTopLevel(),
    );
    expect(mathNoteWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(
      true,
      { visibleOnFullScreen: true },
    );
    expect(mathNoteWindow.show).toHaveBeenCalledTimes(1);
    expect(mathNoteWindow.moveTop).toHaveBeenCalledTimes(1);
    expect(mathNoteWindow.focus).toHaveBeenCalledTimes(1);
    expect(mathNoteWindow.webContents.focus).toHaveBeenCalledTimes(1);
    expect(firstCallOrder(mathNoteWindow.setBounds)).toBeLessThan(
      firstCallOrder(mathNoteWindow.show),
    );
  });

  it("spawns independent math scratchpad windows", async () => {
    const { createMathNoteWindow } = await importQuickNoteWindowModule();

    createMathNoteWindow("/preload.js");
    createMathNoteWindow("/preload.js");

    expect(createdWindows).toHaveLength(2);
    expect(getCreatedWindow(0).options.title).toBe("Math Scratchpad");
    expect(getCreatedWindow(1).options.title).toBe("Math Scratchpad");
  });
});
