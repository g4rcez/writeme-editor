import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppPlatform, isMobile, supportsAI } from "./platform";

const mocks = vi.hoisted(() => ({ native: vi.fn(() => false), electron: vi.fn(() => false) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock("./is-electron", () => ({ isElectron: mocks.electron }));

afterEach(() => {
    vi.unstubAllEnvs();
    mocks.native.mockReturnValue(false);
    mocks.electron.mockReturnValue(false);
});

describe("platform boundaries", () => {
    it("keeps desktop AI enabled", () => {
        mocks.electron.mockReturnValue(true);
        expect(getAppPlatform()).toBe("electron");
        expect(supportsAI()).toBe(true);
    });
    it("recognizes a mobile build before the native bridge exists", () => {
        vi.stubEnv("VITE_WRITEME_TARGET", "mobile");
        expect(getAppPlatform()).toBe("mobile");
        expect(supportsAI()).toBe(false);
    });
    it("recognizes the native bridge and disables AI", () => {
        mocks.native.mockReturnValue(true);
        expect(isMobile()).toBe(true);
        expect(supportsAI()).toBe(false);
    });
    it("keeps ordinary browser behavior", () => {
        expect(getAppPlatform()).toBe("web");
        expect(supportsAI()).toBe(true);
    });
});
