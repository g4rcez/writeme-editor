import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useListSearch } from "./use-list-search";

describe("useListSearch", () => {
  const items = [
    { id: "1", title: "Note 1" },
    { id: "2", title: "Note 2" },
    { id: "3", title: "Note 3" },
  ];
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with selectedIndex 0", () => {
    const { result } = renderHook(() => useListSearch({ items, onSelect }));
    expect(result.current.selectedIndex).toBe(0);
  });

  it("should reset selectedIndex when items length changes", () => {
    const { result, rerender } = renderHook(
      ({ items }) => useListSearch({ items, onSelect }),
      { initialProps: { items } }
    );

    act(() => {
      result.current.setSelectedIndex(2);
    });
    expect(result.current.selectedIndex).toBe(2);

    rerender({ items: items.slice(0, 2) });
    expect(result.current.selectedIndex).toBe(0);
  });

  it("should handle ArrowDown to increment selectedIndex", () => {
    renderHook(() => useListSearch({ items, onSelect }));
    
    act(() => {
      const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
      window.dispatchEvent(event);
    });
    
    // We can't easily check the result here because renderHook returns a stable result 
    // but the state inside the hook changes. We need to check result.current.
  });

  it("should increment index on ArrowDown", () => {
    const { result } = renderHook(() => useListSearch({ items, onSelect }));
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(result.current.selectedIndex).toBe(2);

    // Should not exceed bounds
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(result.current.selectedIndex).toBe(2);
  });

  it("should decrement index on ArrowUp", () => {
    const { result } = renderHook(() => useListSearch({ items, onSelect }));
    
    // Move to index 1 first
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(result.current.selectedIndex).toBe(0);

    // Should not go below 0
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it("should call onSelect when Enter is pressed", () => {
    const { result } = renderHook(() => useListSearch({ items, onSelect }));
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("should not respond to keys when isOpen is false", () => {
    const { result } = renderHook(() => useListSearch({ items, onSelect, isOpen: false }));
    
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    
    expect(result.current.selectedIndex).toBe(0);
  });
});
