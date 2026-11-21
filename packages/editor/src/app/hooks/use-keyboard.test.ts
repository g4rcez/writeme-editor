import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYBOARD_CLOSED, keyboardFromViewport, useKeyboard } from "./use-keyboard";

const mocks = vi.hoisted(() => ({
    native: vi.fn(() => false),
    platform: vi.fn(() => "ios"),
    accessory: vi.fn(async (_options: { isVisible: boolean }) => undefined),
    remove: vi.fn(async () => undefined),
    listeners: new Map<string, (info: { keyboardHeight: number }) => void>(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.native, getPlatform: mocks.platform } }));
vi.mock("@capacitor/keyboard", () => ({
    Keyboard: {
        setAccessoryBarVisible: mocks.accessory,
        addListener: vi.fn(async (name: string, callback: (info: { keyboardHeight: number }) => void) => {
            mocks.listeners.set(name, callback);
            return { remove: mocks.remove };
        }),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.native.mockReturnValue(false);
    mocks.platform.mockReturnValue("ios");
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("keyboardFromViewport", () => {
    it("treats a large shrink of the visual viewport as a keyboard and ignores browser chrome", () => {
        expect(keyboardFromViewport(844, { height: 544, offsetTop: 0 })).toEqual({ open: true, height: 300 });
        expect(keyboardFromViewport(844, { height: 780, offsetTop: 0 })).toBe(KEYBOARD_CLOSED);
        // Scrolling the visual viewport down must not be mistaken for a smaller viewport.
        expect(keyboardFromViewport(844, { height: 544, offsetTop: 300 })).toBe(KEYBOARD_CLOSED);
    });
});

describe("useKeyboard in a browser", () => {
    it("follows visualViewport resizes and unsubscribes", () => {
        const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0 });
        vi.stubGlobal("visualViewport", viewport);
        const removeSpy = vi.spyOn(viewport, "removeEventListener");
        const hook = renderHook(useKeyboard);
        expect(hook.result.current.open).toBe(false);
        act(() => {
            viewport.height = window.innerHeight - 320;
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(hook.result.current).toEqual({ open: true, height: 320 });
        act(() => {
            viewport.height = window.innerHeight;
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(hook.result.current.open).toBe(false);
        hook.unmount();
        expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    });
});

describe("useKeyboard on a Capacitor device", () => {
    it("hides the iOS accessory bar and follows the native keyboard events", async () => {
        mocks.native.mockReturnValue(true);
        const hook = renderHook(useKeyboard);
        await waitFor(() => expect(mocks.listeners.size).toBe(2));
        expect(mocks.accessory).toHaveBeenCalledWith({ isVisible: false });
        act(() => mocks.listeners.get("keyboardWillShow")?.({ keyboardHeight: 291.4 }));
        expect(hook.result.current).toEqual({ open: true, height: 291 });
        act(() => mocks.listeners.get("keyboardWillHide")?.({ keyboardHeight: 0 }));
        expect(hook.result.current.open).toBe(false);
        hook.unmount();
        expect(mocks.remove).toHaveBeenCalledTimes(2);
    });

    it("leaves the accessory bar alone on Android", async () => {
        mocks.native.mockReturnValue(true);
        mocks.platform.mockReturnValue("android");
        renderHook(useKeyboard);
        await waitFor(() => expect(mocks.listeners.size).toBe(2));
        expect(mocks.accessory).not.toHaveBeenCalled();
    });
});
