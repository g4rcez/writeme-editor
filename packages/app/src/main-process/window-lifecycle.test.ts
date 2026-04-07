import { describe, it, expect, vi } from "vitest";
import { handleWindowClose, openQuickNote } from "./window-lifecycle";

describe("Window Lifecycle", () => {
  describe("handleWindowClose", () => {
    it("should prevent default and hide window if not quitting", () => {
      const event = { preventDefault: vi.fn() } as any;
      const window = { hide: vi.fn() } as any;
      
      handleWindowClose(event, window, false);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(window.hide).toHaveBeenCalled();
    });

    it("should do nothing if quitting", () => {
      const event = { preventDefault: vi.fn() } as any;
      const window = { hide: vi.fn() } as any;
      
      handleWindowClose(event, window, true);
      
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(window.hide).not.toHaveBeenCalled();
    });
  });

  describe("openQuickNote", () => {
    it("should show, focus and send event to window", () => {
        const webContents = { send: vi.fn() };
        const window = { 
            show: vi.fn(),
            focus: vi.fn(),
            webContents
        } as any;

        openQuickNote(window);

        expect(window.show).toHaveBeenCalled();
        expect(window.focus).toHaveBeenCalled();
        expect(webContents.send).toHaveBeenCalledWith("quicknote:open");
    });
    
    it("should do nothing if window is null", () => {
        openQuickNote(null);
    });
  });
});
