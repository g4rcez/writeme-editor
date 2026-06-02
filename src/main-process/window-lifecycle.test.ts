import { describe, it, expect, vi } from "vitest";
import { type Event } from "electron";
import { handleWindowClose, openQuickNote } from "./window-lifecycle";

type CloseEvent = Pick<Event, "preventDefault" | "defaultPrevented">;
type CloseWindow = {
  hide(): void;
};
type QuickNoteWindow = {
  show(): void;
  focus(): void;
  webContents: {
    send(channel: string): void;
  };
};

describe("Window Lifecycle", () => {
  describe("handleWindowClose", () => {
    it("should prevent default and hide window if not quitting", () => {
      let defaultPrevented = false;
      const event: CloseEvent = {
        get defaultPrevented() {
          return defaultPrevented;
        },
        preventDefault: vi.fn(() => {
          defaultPrevented = true;
        }),
      };
      const window: CloseWindow = { hide: vi.fn() };

      handleWindowClose(event, window, false);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(window.hide).toHaveBeenCalledTimes(1);
    });

    it("should do nothing if quitting", () => {
      let defaultPrevented = false;
      const event: CloseEvent = {
        get defaultPrevented() {
          return defaultPrevented;
        },
        preventDefault: vi.fn(() => {
          defaultPrevented = true;
        }),
      };
      const window: CloseWindow = { hide: vi.fn() };

      handleWindowClose(event, window, true);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(window.hide).not.toHaveBeenCalled();
    });
  });

  describe("openQuickNote", () => {
    it("should show, focus and send event to window", () => {
      const webContents: QuickNoteWindow["webContents"] = { send: vi.fn() };
      const window: QuickNoteWindow = {
        show: vi.fn(),
        focus: vi.fn(),
        webContents,
      };

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
