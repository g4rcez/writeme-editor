import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyFetch } from "./proxy-fetch";

const desktopToken = "desktop-proxy-test-token";

function mockDesktopBridge(): ReturnType<typeof vi.fn<() => Promise<string>>> {
    const getProxyToken = vi.fn<() => Promise<string>>().mockResolvedValue(desktopToken);
    vi.stubGlobal("window", { electronAPI: { ai: { getProxyToken } } });
    return getProxyToken;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("proxyFetch", () => {
    it.each([
        "https://auth.openai.com/api/accounts/deviceauth/usercode",
        "https://api.openai.com/v1/models",
        "https://api.anthropic.com/v1/models",
        "https://generativelanguage.googleapis.com/v1beta/models",
        "http://localhost:11434/api/tags",
    ])("authenticates desktop requests to %s", async (target) => {
        const getProxyToken = mockDesktopBridge();
        const response = new Response("ok");
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
        vi.stubGlobal("fetch", fetchMock);
        const headers = new Headers({ Authorization: "Bearer provider-test-token" });
        const signal = new AbortController().signal;

        expect(await proxyFetch(target, { method: "POST", headers, body: "{}", signal, redirect: "follow" })).toBe(
            response,
        );
        expect(getProxyToken).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:4079/proxy",
            expect.objectContaining({ method: "POST", body: "{}", signal, redirect: "error" }),
        );
        const proxyHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(proxyHeaders.get("x-target-url")).toBe(target);
        expect(proxyHeaders.get("x-writeme-proxy-token")).toBe(desktopToken);
        expect(proxyHeaders.get("authorization")).toBe("Bearer provider-test-token");
        expect(headers.has("x-writeme-proxy-token")).toBe(false);
    });

    it("keeps browser requests on the existing local proxy without a desktop token", async () => {
        vi.stubGlobal("window", {});
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
        vi.stubGlobal("fetch", fetchMock);

        await proxyFetch(new URL("https://api.openai.com/v1/models"), { redirect: "manual" });

        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("x-target-url")).toBe("https://api.openai.com/v1/models");
        expect(headers.has("x-writeme-proxy-token")).toBe(false);
        expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("manual");
    });

    it("does not send a request when desktop token access is denied", async () => {
        const getProxyToken = mockDesktopBridge().mockRejectedValue(new Error("AI proxy access denied."));
        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        await expect(proxyFetch("https://auth.openai.com/oauth/token")).rejects.toThrow("AI proxy access denied.");
        expect(getProxyToken).toHaveBeenCalledOnce();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns streaming responses without buffering them", async () => {
        mockDesktopBridge();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("data: first\n\n"));
            },
        });
        const response = new Response(stream, { headers: { "content-type": "text/event-stream" } });
        vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

        const result = await proxyFetch("https://api.openai.com/v1/responses");
        expect(result).toBe(response);
        const reader = result.body?.getReader();
        expect(await reader?.read()).toStrictEqual({
            done: false,
            value: new TextEncoder().encode("data: first\n\n"),
        });
        await reader?.cancel();
    });

    it("keeps the desktop token on rate-limit retries", async () => {
        vi.useFakeTimers();
        const getProxyToken = mockDesktopBridge();
        const response = new Response("ok");
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "1" } }))
            .mockResolvedValueOnce(response);
        vi.stubGlobal("fetch", fetchMock);

        const request = proxyFetch("https://api.openai.com/v1/models");
        await vi.advanceTimersByTimeAsync(1000);
        expect(await request).toBe(response);
        expect(getProxyToken).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        for (const [, init] of fetchMock.mock.calls) {
            expect(new Headers(init?.headers).get("x-writeme-proxy-token")).toBe(desktopToken);
        }
    });
});
