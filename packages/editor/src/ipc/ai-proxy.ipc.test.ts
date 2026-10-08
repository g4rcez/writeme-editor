import { beforeEach, describe, expect, it, vi } from "vitest";

const { handle } = vi.hoisted(() => ({
    handle: vi.fn<
        (
            channel: string,
            handler: (event: { senderFrame: { url: string } | null; sender: { mainFrame: { url: string } } }) => string,
        ) => void
    >(),
}));
vi.mock("electron", () => ({ ipcMain: { handle } }));

import { registerAIProxyHandlers } from "./ai-proxy.ipc";

const rendererUrl =
    "file:///Applications/Write%20Me.app/Contents/Resources/app.asar/.vite/renderer/main_window/index.html";
const desktopToken = "desktop-proxy-test-token";

function requestToken(url: string | null, mainFrame = true): string {
    const handler = handle.mock.calls[0]?.[1];
    if (!handler) throw new Error("AI proxy handler not registered.");
    const frame = url === null ? null : { url };
    return handler({
        senderFrame: frame,
        sender: { mainFrame: mainFrame && frame ? frame : { url: rendererUrl } },
    });
}

beforeEach(() => handle.mockReset());

describe("registerAIProxyHandlers", () => {
    it.each(["", "#/settings/ai", "#/floating-editor", "#/folder?path=workspace"])(
        "returns the session token to the packaged app renderer %s",
        (route) => {
            registerAIProxyHandlers(desktopToken, rendererUrl);

            expect(handle).toHaveBeenCalledWith("ai:proxy-token", expect.any(Function));
            expect(requestToken(`${rendererUrl}${route}`)).toBe(desktopToken);
        },
    );

    it("returns the session token to the configured development renderer", () => {
        registerAIProxyHandlers(desktopToken, "http://localhost:5173");

        expect(requestToken("http://localhost:5173/#/settings/ai")).toBe(desktopToken);
    });

    it.each([
        null,
        "",
        "not-a-url",
        "file:///tmp/untrusted.html",
        "https://example.com/",
        "http://localhost:5173/",
        `${rendererUrl}?untrusted=true`,
    ])("denies token access from %s", (url) => {
        registerAIProxyHandlers(desktopToken, rendererUrl);

        expect(() => requestToken(url)).toThrow("AI proxy access denied.");
    });

    it("denies token access to subframes even at the trusted URL", () => {
        registerAIProxyHandlers(desktopToken, rendererUrl);

        expect(() => requestToken(rendererUrl, false)).toThrow("AI proxy access denied.");
    });

    it("rejects an invalid renderer URL at registration", () => {
        expect(() => registerAIProxyHandlers(desktopToken, "not-a-url")).toThrow("Invalid app renderer URL.");
        expect(handle).not.toHaveBeenCalled();
    });
});
