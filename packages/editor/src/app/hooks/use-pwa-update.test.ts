import type { RegisterSWOptions } from "virtual:pwa-register/react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateServiceWorkerMock, useRegisterSWMock } = vi.hoisted(() => ({
    updateServiceWorkerMock: vi.fn(async (_reloadPage?: boolean) => {}),
    useRegisterSWMock: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
    useRegisterSW: useRegisterSWMock,
}));

vi.mock("@/lib/is-electron", () => ({
    isElectron: () => false,
}));

import { usePwaUpdate } from "./use-pwa-update";

const getRegisterOptions = (): RegisterSWOptions => {
    const options = useRegisterSWMock.mock.calls.at(-1)?.[0] as RegisterSWOptions | undefined;

    if (!options) throw new Error("useRegisterSW was not called with options");

    return options;
};

const mockRegisterState = (needRefresh = false): void => {
    useRegisterSWMock.mockReturnValue({
        needRefresh: [needRefresh, vi.fn()],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
    });
};

describe("usePwaUpdate", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockRegisterState();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("registers the service worker immediately", () => {
        renderHook(() => usePwaUpdate());

        expect(getRegisterOptions().immediate).toBe(true);
    });

    it("activates a waiting service worker when the prompt update path fires", () => {
        mockRegisterState(true);

        renderHook(() => usePwaUpdate());

        expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
    });

    it("checks for new service workers on registration, interval, and tab focus", () => {
        const updateMock = vi.fn(async () => {});
        const registration: ServiceWorkerRegistration = Object.create(null);
        Object.defineProperty(registration, "update", { value: updateMock });

        const { unmount } = renderHook(() => usePwaUpdate());

        act(() => {
            getRegisterOptions().onRegisteredSW?.("/sw.js", registration);
        });

        expect(updateMock).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(60 * 60 * 1000);
        });

        expect(updateMock).toHaveBeenCalledTimes(2);

        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });

        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });

        expect(updateMock).toHaveBeenCalledTimes(3);

        unmount();

        act(() => {
            vi.advanceTimersByTime(60 * 60 * 1000);
        });

        expect(updateMock).toHaveBeenCalledTimes(3);
    });
});
