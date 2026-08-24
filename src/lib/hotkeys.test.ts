import { afterEach, describe, expect, it, vi } from "vitest";
import { registerHotkey, registerHotkeys } from "./hotkeys";

let unregisterHandlers: Array<() => void> = [];

function cleanup(): void {
    for (const unregister of unregisterHandlers) unregister();
    unregisterHandlers = [];
}

function keydown(
    key: string,
    overrides: Partial<Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "code">> = {},
): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
        ...overrides,
    });
    window.dispatchEvent(event);
    return event;
}

describe("hotkeys", () => {
    afterEach(() => {
        cleanup();
    });

    it("registers Ctrl+Tab callbacks", () => {
        const callback = vi.fn();
        unregisterHandlers.push(registerHotkey("Ctrl+Tab", callback));

        const event = keydown("Tab", { ctrlKey: true });

        expect(callback).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
    });

    it("does not match missing modifiers", () => {
        const callback = vi.fn();
        unregisterHandlers.push(registerHotkey("Ctrl+Tab", callback));

        keydown("Tab");

        expect(callback).not.toHaveBeenCalled();
    });

    it("supports Mod shortcuts with Ctrl or Meta", () => {
        const callback = vi.fn();
        unregisterHandlers.push(registerHotkey("Mod+P", callback));

        keydown("p", { ctrlKey: true });
        keydown("P", { metaKey: true });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("matches shifted digits by their physical digit key", () => {
        const callback = vi.fn();
        unregisterHandlers.push(registerHotkey("Mod+Shift+1", callback));

        keydown("!", { code: "Digit1", ctrlKey: true, shiftKey: true });

        expect(callback).toHaveBeenCalledOnce();
    });

    it("unregisters callbacks", () => {
        const callback = vi.fn();
        const unregister = registerHotkey("Ctrl+K", callback);
        unregister();

        keydown("k", { ctrlKey: true });

        expect(callback).not.toHaveBeenCalled();
    });

    it("registers multiple hotkeys with one cleanup", () => {
        const first = vi.fn();
        const second = vi.fn();
        unregisterHandlers.push(
            registerHotkeys([
                { hotkey: "Mod+1", callback: first },
                { hotkey: "Mod+2", callback: second },
            ]),
        );

        keydown("1", { metaKey: true });
        keydown("2", { ctrlKey: true });

        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });

    it("allows callbacks to manage preventDefault manually", () => {
        const callback = vi.fn((event: KeyboardEvent) => event.preventDefault());
        unregisterHandlers.push(registerHotkey("Mod+P", callback, { preventDefault: false }));

        const event = keydown("p", { metaKey: true });

        expect(callback).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
    });
});
