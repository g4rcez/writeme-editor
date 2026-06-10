import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWorkspaceKey, useGlobalStore } from "./global.store";

// Mock repositories
vi.mock("./repositories", () => ({
  repositories: {
    tabs: {
      save: vi.fn(),
      delete: vi.fn(),
      updateOrder: vi.fn(),
    },
    notes: {
      update: vi.fn(),
      getOne: vi.fn(),
    },
  },
}));

// Mock window and document
Object.defineProperty(window, "scrollTo", { value: vi.fn() });
Object.defineProperty(document.documentElement, "classList", {
  value: { add: vi.fn(), remove: vi.fn() },
});

describe("Tab Management Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGlobalStore.dispatchers.init(
      "light" as any,
      [],
      [],
      16,
      256,
      null,
      null,
    );
  });

  it("should keep local-storage tabs in a stable local workspace bucket", () => {
    expect(getWorkspaceKey(null)).toBe("__local__");
    expect(getWorkspaceKey("")).toBe("__local__");
  });

  it("should use the workspace directory as the tab isolation key", () => {
    const workspace = "/Users/allangarcez/Documents/g4rcez/writeme-editor";

    expect(getWorkspaceKey(workspace)).toBe(workspace);
  });
});
