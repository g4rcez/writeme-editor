import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createForwardHeaders, createProxyApp, createResponseHeaders } from "./proxy";

describe("createForwardHeaders", () => {
    it("removes local proxy and hop-by-hop headers before forwarding upstream", () => {
        const headers = createForwardHeaders(
            new Headers({
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate, br",
                Authorization: "Bearer token",
                Connection: "keep-alive",
                "Content-Length": "166",
                "Content-Type": "application/x-www-form-urlencoded",
                Host: "localhost:4079",
                Origin: "http://localhost:5173",
                "Transfer-Encoding": "chunked",
                "X-Target-URL": "https://auth.openai.com/oauth/token",
                "X-Upstream-User-Agent": "codex_cli_rs/0.0.1",
                "X-Writeme-Proxy-Token": "desktop-proxy-test-token",
            }),
        );

        expect(Object.fromEntries(headers.entries())).toStrictEqual({
            accept: "application/json",
            "accept-encoding": "identity",
            authorization: "Bearer token",
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "codex_cli_rs/0.0.1",
        });
    });
});

describe("createResponseHeaders", () => {
    it("removes upstream compression headers from decoded proxy responses", () => {
        const headers = createResponseHeaders(
            new Headers({
                "Cache-Control": "private",
                "Content-Encoding": "gzip",
                "Content-Length": "42",
                "Content-Type": "application/json",
            }),
        );

        expect(headers).toStrictEqual({
            "cache-control": "no-store",
            "content-type": "application/json",
        });
    });
});

const desktopToken = "desktop-proxy-test-token";

function createProxyRequest({
    origin = "null",
    token = desktopToken,
    target = "https://auth.openai.com/api/accounts/deviceauth/usercode",
}: {
    origin?: string | null;
    token?: string | null;
    target?: string;
} = {}): Request {
    const headers = new Headers({
        "x-target-url": target,
        authorization: "Bearer provider-test-token",
        "content-type": "application/json",
    });
    if (origin !== null) headers.set("origin", origin);
    if (token !== null) headers.set("x-writeme-proxy-token", token);
    return new Request("http://localhost:4079/proxy", { method: "POST", headers, body: "{}" });
}

describe("AI proxy desktop access", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        fetchMock.mockReset().mockResolvedValue(new Response("upstream", { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => vi.unstubAllGlobals());

    it.each([
        "https://auth.openai.com/api/accounts/deviceauth/usercode",
        "https://api.openai.com/v1/models",
        "https://api.anthropic.com/v1/models",
        "https://generativelanguage.googleapis.com/v1beta/models",
        "http://localhost:11434/api/tags",
    ])("forwards authenticated packaged-app requests to %s", async (target) => {
        const app = createProxyApp(desktopToken);
        const response = await app.handle(createProxyRequest({ target }));

        expect(response.status).toBe(201);
        expect(await response.text()).toBe("upstream");
        expect(response.headers.get("access-control-allow-origin")).toBe("null");
        expect(fetchMock).toHaveBeenCalledWith(new URL(target), expect.objectContaining({ method: "POST" }));
        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("authorization")).toBe("Bearer provider-test-token");
        expect(headers.has("x-writeme-proxy-token")).toBe(false);
        expect(headers.has("origin")).toBe(false);
    });

    it("forwards OpenAI device authorization without an Origin header", async () => {
        const target = "https://auth.openai.com/api/accounts/deviceauth/usercode";
        const body = JSON.stringify({ client_id: "desktop-device-auth-test-client" });
        const deviceAuthorization = { device_auth_id: "test-device", user_code: "TEST-CODE", interval: 5 };
        fetchMock.mockResolvedValue(Response.json(deviceAuthorization));
        const request = new Request("http://localhost:4079/proxy", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-target-url": target,
                "x-writeme-proxy-token": desktopToken,
            },
            body,
        });

        const response = await createProxyApp(desktopToken).handle(request);

        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual(deviceAuthorization);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            new URL(target),
            expect.objectContaining({ method: "POST", redirect: "manual" }),
        );
        const upstreamInit = fetchMock.mock.calls[0]?.[1];
        expect(await new Response(upstreamInit?.body).text()).toBe(body);
        const headers = new Headers(upstreamInit?.headers);
        expect(headers.get("content-type")).toBe("application/json");
        expect(headers.has("authorization")).toBe(false);
        expect(headers.has("origin")).toBe(false);
        expect(headers.has("x-writeme-proxy-token")).toBe(false);
    });

    it.each([
        { token: null },
        { token: "wrong-session-token" },
        { origin: null, token: null },
        { origin: null, token: "wrong-session-token" },
        { origin: "" },
        { origin: "https://example.com" },
    ])("rejects unauthorized requests %j", async (options) => {
        const response = await createProxyApp(desktopToken).handle(createProxyRequest(options));

        expect(response.status).toBe(403);
        expect(await response.text()).toBe("Forbidden");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(["null", null])("keeps desktop origin %j disabled in the standalone browser proxy", async (origin) => {
        const response = await createProxyApp().handle(createProxyRequest({ origin }));

        expect(response.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects originless requests when the configured desktop token is empty", async () => {
        const response = await createProxyApp("").handle(createProxyRequest({ origin: null, token: "" }));

        expect(response.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps local web-development requests working without a desktop token", async () => {
        const response = await createProxyApp().handle(
            createProxyRequest({ origin: "http://localhost:5173", token: null }),
        );

        expect(response.status).toBe(201);
        expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
        expect(await response.text()).toBe("upstream");
    });

    it("allows the packaged-app preflight for the session token header", async () => {
        const response = await createProxyApp(desktopToken).handle(
            new Request("http://localhost:4079/proxy", {
                method: "OPTIONS",
                headers: {
                    origin: "null",
                    "access-control-request-method": "POST",
                    "access-control-request-headers": "content-type,x-target-url,x-writeme-proxy-token",
                },
            }),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBe("null");
        expect(response.headers.get("access-control-allow-headers")).toContain("x-writeme-proxy-token");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        ["anthropic-version", "anthropic-beta", "x-api-key"],
        ["x-goog-api-key", "x-goog-api-client"],
        ["authorization", "x-stainless-runtime", "x-stainless-runtime-version"],
    ])("allows provider SDK preflight headers %j", async (...providerHeaders) => {
        const requestedHeaders = ["content-type", "x-target-url", "x-writeme-proxy-token", ...providerHeaders];
        for (const origin of ["null", "http://localhost:5173"]) {
            const response = await createProxyApp(desktopToken).handle(
                new Request("http://localhost:4079/proxy", {
                    method: "OPTIONS",
                    headers: {
                        origin,
                        "access-control-request-method": "POST",
                        "access-control-request-headers": requestedHeaders.join(","),
                    },
                }),
            );

            expect(response.status).toBe(204);
            expect(response.headers.get("access-control-allow-origin")).toBe(origin);
            const allowedHeaders = response.headers.get("access-control-allow-headers")?.split(/,\s*/);
            expect(allowedHeaders).toEqual(expect.arrayContaining(requestedHeaders));
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not grant preflight access to remote origins", async () => {
        const response = await createProxyApp(desktopToken).handle(
            new Request("http://localhost:4079/proxy", {
                method: "OPTIONS",
                headers: {
                    origin: "https://example.com",
                    "access-control-request-method": "POST",
                    "access-control-request-headers": "authorization,x-target-url,x-writeme-proxy-token",
                },
            }),
        );

        expect(response.headers.get("access-control-allow-origin")).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(["null", null])("keeps private non-Ollama targets blocked for desktop origin %j", async (origin) => {
        const response = await createProxyApp(desktopToken).handle(
            createProxyRequest({ origin, target: "http://127.0.0.1:8080/admin" }),
        );

        expect(response.status).toBe(403);
        expect(await response.text()).toBe("Target host blocked");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("streams upstream responses without reading them into memory", async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("data: first\n\n"));
            },
        });
        fetchMock.mockResolvedValue(new Response(stream, { headers: { "content-type": "text/event-stream" } }));

        const response = await createProxyApp(desktopToken).handle(createProxyRequest());
        const reader = response.body?.getReader();
        expect(response.headers.get("content-type")).toBe("text/event-stream");
        expect(await reader?.read()).toStrictEqual({
            done: false,
            value: new TextEncoder().encode("data: first\n\n"),
        });
        await reader?.cancel();
    });
});
