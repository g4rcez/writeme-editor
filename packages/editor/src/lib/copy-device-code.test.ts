import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    isElectron: vi.fn(),
    writeText: vi.fn(),
    copyDeviceCode: vi.fn(),
}));
vi.mock("./is-electron", () => ({ isElectron: mocks.isElectron }));

import { copyDeviceCode } from "./copy-device-code";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.isElectron.mockReturnValue(false);
    mocks.writeText.mockResolvedValue(undefined);
    mocks.copyDeviceCode.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: mocks.writeText } });
    vi.stubGlobal("electronAPI", { ai: { copyDeviceCode: mocks.copyDeviceCode } });
});

afterEach(() => vi.unstubAllGlobals());

describe("copyDeviceCode", () => {
    it("copies through the browser clipboard", async () => {
        expect(await copyDeviceCode("ABCD-1234")).toBe(true);
        expect(mocks.writeText).toHaveBeenCalledExactlyOnceWith("ABCD-1234");
        expect(mocks.copyDeviceCode).not.toHaveBeenCalled();
    });

    it("uses native IPC on desktop, without browser focus or clipboard permissions", async () => {
        mocks.isElectron.mockReturnValue(true);
        expect(await copyDeviceCode("ABCD-1234")).toBe(true);
        expect(mocks.copyDeviceCode).toHaveBeenCalledExactlyOnceWith("ABCD-1234");
        expect(mocks.writeText).not.toHaveBeenCalled();
    });

    it("reports denied browser clipboard access without aborting sign-in", async () => {
        mocks.writeText.mockRejectedValue(new Error("Permission denied"));
        expect(await copyDeviceCode("ABCD-1234")).toBe(false);
    });

    it("reports unavailable browser clipboard access", async () => {
        vi.stubGlobal("navigator", {});
        expect(await copyDeviceCode("ABCD-1234")).toBe(false);
    });

    it("reports native clipboard failures", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.copyDeviceCode.mockRejectedValue(new Error("Clipboard unavailable"));
        expect(await copyDeviceCode("ABCD-1234")).toBe(false);
    });
});
