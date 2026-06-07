import { beforeEach, describe, expect, it, vi } from "vitest";
import { isElectron } from "@/lib/is-electron";

vi.mock("@/lib/is-electron", () => ({
  isElectron: vi.fn(),
}));

vi.mock("./repositories", () => ({
  repositories: {
    tabs: {
      clear: vi.fn(),
      delete: vi.fn(),
      deleteByNoteId: vi.fn(),
      getAll: vi.fn(),
      save: vi.fn(),
      updateOrder: vi.fn(),
    },
    notes: {
      delete: vi.fn(),
      emptyTrash: vi.fn(),
      getAll: vi.fn(),
      getOne: vi.fn(),
      hardDelete: vi.fn(),
      restore: vi.fn(),
      update: vi.fn(),
      updateContent: vi.fn(),
    },
    noteGroups: {
      delete: vi.fn(),
      getAll: vi.fn(),
      save: vi.fn(),
    },
    noteGroupMembers: {
      delete: vi.fn(),
      deleteByGroupId: vi.fn(),
      deleteByNoteId: vi.fn(),
      getAll: vi.fn(),
      reorder: vi.fn(),
      save: vi.fn(),
    },
  },
}));

vi.mock("./settings", () => ({
  SettingsService: {
    save: vi.fn(),
  },
}));

vi.mock("./ui.store", () => ({
  uiDispatch: {
    setError: vi.fn(),
  },
}));

import { loadHomedir } from "./global.store";

const mockedIsElectron = vi.mocked(isElectron);

const setElectronHome = (homedir: string): (() => Promise<string>) => {
  const getHome = vi.fn(async () => homedir);
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: { env: { getHome } },
  });
  return getHome;
};

describe("global store homedir state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(window, "electronAPI");
    document.documentElement.className = "";
  });

  it("keeps homedir null and avoids Electron IPC in browser mode", async () => {
    mockedIsElectron.mockReturnValue(false);
    const getHome = setElectronHome("/Users/browser-should-not-call");

    const result = await loadHomedir();

    expect(getHome).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("loads homedir through Electron IPC in Electron mode", async () => {
    mockedIsElectron.mockReturnValue(true);
    const getHome = setElectronHome("/Users/allan");

    const result = await loadHomedir();

    expect(getHome).toHaveBeenCalledTimes(1);
    expect(result).toBe("/Users/allan");
  });

  it("keeps homedir null when Electron home lookup fails", async () => {
    mockedIsElectron.mockReturnValue(true);
    const error = new Error("IPC failed");
    const getHome = vi.fn(async () => {
      throw error;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { env: { getHome } },
    });

    const result = await loadHomedir();

    expect(getHome).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith("Failed to load home directory:", error);
    warn.mockRestore();
  });
});
