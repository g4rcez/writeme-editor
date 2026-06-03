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
};

type MockWithCallOrder = {
  mock: {
    invocationCallOrder: number[];
  };
};

const createdWindows: MockBrowserWindow[] = [];

let cursorPoint: Point = { x: 1600, y: 200 };
let workArea: WorkArea = { x: 1440, y: 25, width: 1920, height: 1055 };

const screenMock = {
  getCursorScreenPoint: vi.fn(() => cursorPoint),
  getDisplayNearestPoint: vi.fn(() => ({ workArea })),
};

class MockBrowserWindow {
  readonly options: BrowserWindowOptions;
  private readyToShow: (() => void) | null = null;

  isDestroyed = vi.fn(() => false);
  setBounds = vi.fn<(bounds: FloatingPanelBounds, animate: boolean) => void>();
  setAlwaysOnTop = vi.fn<(flag: boolean, level: string) => void>();
  setVisibleOnAllWorkspaces =
    vi.fn<
      (visible: boolean, options: { visibleOnFullScreen: boolean }) => void
    >();
  moveTop = vi.fn<() => void>();
  show = vi.fn<() => void>();
  focus = vi.fn<() => void>();
  hide = vi.fn<() => void>();
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

  on(): this {
    return this;
  }

  triggerReadyToShow(): void {
    this.readyToShow?.();
  }
}

vi.mock("electron", () => ({
  BrowserWindow: MockBrowserWindow,
  screen: screenMock,
}));

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
    });
    expect(screenMock.getCursorScreenPoint).toHaveBeenCalledTimes(1);
    expect(screenMock.getDisplayNearestPoint).toHaveBeenCalledWith(cursorPoint);
  });

  it("recenters and restacks a reused quick note before showing it", async () => {
    const { createQuickNoteWindow } = await importQuickNoteWindowModule();

    createQuickNoteWindow("/preload.js");
    const quickNoteWindow = getCreatedWindow(0);
    quickNoteWindow.triggerReadyToShow();

    quickNoteWindow.setBounds.mockClear();
    quickNoteWindow.setAlwaysOnTop.mockClear();
    quickNoteWindow.setVisibleOnAllWorkspaces.mockClear();
    quickNoteWindow.moveTop.mockClear();
    quickNoteWindow.show.mockClear();
    quickNoteWindow.focus.mockClear();

    workArea = { x: -1728, y: 0, width: 1728, height: 1117 };
    const expectedBounds = expectedBoundsFor(workArea);

    createQuickNoteWindow("/preload.js");

    expect(createdWindows).toHaveLength(1);
    expect(quickNoteWindow.setBounds).toHaveBeenCalledWith(
      expectedBounds,
      false,
    );
    expect(quickNoteWindow.setAlwaysOnTop).toHaveBeenCalledWith(
      true,
      "floating",
    );
    expect(quickNoteWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(
      true,
      { visibleOnFullScreen: true },
    );
    expect(quickNoteWindow.moveTop).toHaveBeenCalledTimes(1);
    expect(quickNoteWindow.show).toHaveBeenCalledTimes(1);
    expect(quickNoteWindow.focus).toHaveBeenCalledTimes(1);
    expect(firstCallOrder(quickNoteWindow.setBounds)).toBeLessThan(
      firstCallOrder(quickNoteWindow.show),
    );
  });

  it("recenters and restacks a reused math note before showing it", async () => {
    const { createMathNoteWindow } = await importQuickNoteWindowModule();

    createMathNoteWindow("/preload.js");
    const mathNoteWindow = getCreatedWindow(0);
    mathNoteWindow.triggerReadyToShow();

    mathNoteWindow.setBounds.mockClear();
    mathNoteWindow.setAlwaysOnTop.mockClear();
    mathNoteWindow.setVisibleOnAllWorkspaces.mockClear();
    mathNoteWindow.moveTop.mockClear();
    mathNoteWindow.show.mockClear();
    mathNoteWindow.focus.mockClear();

    workArea = { x: 0, y: 40, width: 1512, height: 902 };
    const expectedBounds = expectedBoundsFor(workArea);

    createMathNoteWindow("/preload.js");

    expect(createdWindows).toHaveLength(1);
    expect(mathNoteWindow.setBounds).toHaveBeenCalledWith(
      expectedBounds,
      false,
    );
    expect(mathNoteWindow.setAlwaysOnTop).toHaveBeenCalledWith(
      true,
      "floating",
    );
    expect(mathNoteWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(
      true,
      { visibleOnFullScreen: true },
    );
    expect(mathNoteWindow.moveTop).toHaveBeenCalledTimes(1);
    expect(mathNoteWindow.show).toHaveBeenCalledTimes(1);
    expect(mathNoteWindow.focus).toHaveBeenCalledTimes(1);
    expect(firstCallOrder(mathNoteWindow.setBounds)).toBeLessThan(
      firstCallOrder(mathNoteWindow.show),
    );
  });
});
