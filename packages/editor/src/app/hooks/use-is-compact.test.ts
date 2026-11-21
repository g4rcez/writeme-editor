import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsCompact, usePhoneShell } from "./use-is-compact";

const mocks = vi.hoisted(() => ({ mobile: vi.fn(() => true) }));
vi.mock("@/lib/platform", () => ({ isMobile: mocks.mobile }));

type Listener = () => void;
let matches = false;
const listeners = new Set<Listener>();

beforeEach(() => {
    matches = false;
    listeners.clear();
    mocks.mobile.mockReturnValue(true);
    vi.stubGlobal("matchMedia", () => ({
        get matches() {
            return matches;
        },
        addEventListener: (_: string, fn: Listener) => listeners.add(fn),
        removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
    }));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const resize = (compact: boolean) =>
    act(() => {
        matches = compact;
        listeners.forEach((fn) => fn());
    });

describe("useIsCompact", () => {
    it("tracks the 767px breakpoint and unsubscribes on unmount", () => {
        const hook = renderHook(useIsCompact);
        expect(hook.result.current).toBe(false);
        resize(true);
        expect(hook.result.current).toBe(true);
        hook.unmount();
        expect(listeners.size).toBe(0);
    });
});

describe("usePhoneShell", () => {
    it("is on only for the mobile build at compact width", () => {
        matches = true;
        expect(renderHook(usePhoneShell).result.current).toBe(true);
        cleanup();
        matches = false;
        expect(renderHook(usePhoneShell).result.current).toBe(false);
        cleanup();
        matches = true;
        mocks.mobile.mockReturnValue(false);
        expect(renderHook(usePhoneShell).result.current).toBe(false);
    });
});
