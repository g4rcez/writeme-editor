import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWritemeShortcuts, Type } from "./shortcut-items";
import { useGlobalStore } from "../../store/global.store";

vi.mock("../../store/global.store", () => ({
  useGlobalStore: vi.fn(),
  globalDispatch: {
    theme: vi.fn(),
  },
}));

describe("shortcut-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useGlobalStore as any).mockReturnValue([{}, vi.fn()]);
  });

  it("should include the 'Open Recent' shortcut", () => {
    const { result } = renderHook(() => useWritemeShortcuts());
    const openRecent = result.current.find(s => s.description === "Open Recent");
    
    expect(openRecent).toBeDefined();
    expect(openRecent?.bind).toBe("mod+e");
    expect(openRecent?.type).toBe(Type.Shortcut);
  });

  it("should have all required shortcuts", () => {
    const { result } = renderHook(() => useWritemeShortcuts());
    const descriptions = result.current.map(s => s.description);
    
    expect(descriptions).toContain("Commander");
    expect(descriptions).toContain("Open Recent");
    expect(descriptions).toContain("Browse files");
    expect(descriptions).toContain("Open project");
  });
});
