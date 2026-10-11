import { expect, it, vi } from "vitest";
import { initializeMobileRuntime, MOBILE_PAUSE_EVENT } from "./mobile-runtime";

const mocks = vi.hoisted(() => ({
    listener: vi.fn(async (_name: string, _handler: (state: { isActive: boolean }) => void) => undefined),
    open: vi.fn(async () => undefined),
    style: vi.fn(async () => undefined),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.listener } }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: mocks.open } }));
vi.mock("@capacitor/status-bar", () => ({
    StatusBar: { setStyle: mocks.style },
    Style: { Dark: "DARK", Light: "LIGHT" },
}));

it("bridges backgrounding, matches system chrome and opens external links in the native browser", async () => {
    document.documentElement.classList.add("dark");
    const pause = vi.fn();
    window.addEventListener(MOBILE_PAUSE_EVENT, pause);
    await initializeMobileRuntime();
    expect(mocks.style).toHaveBeenCalledWith({ style: "DARK" });
    const handler = mocks.listener.mock.calls[0]?.[1];
    handler?.({ isActive: false });
    expect(pause).toHaveBeenCalledOnce();
    handler?.({ isActive: true });
    expect(pause).toHaveBeenCalledOnce();
    const anchor = document.createElement("a");
    anchor.href = "https://www.writeme.dev/about";
    document.body.append(anchor);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(mocks.open).toHaveBeenCalledWith({ url: anchor.href });
    anchor.remove();
    window.removeEventListener(MOBILE_PAUSE_EVENT, pause);
});
