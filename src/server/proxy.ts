import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";

const STRIPPED_HEADERS = new Set([
    "accept-encoding",
    "host",
    "origin",
    "referer",
    "x-target-url",
    "x-upstream-user-agent",
    "connection",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
]);
const STRIPPED_RESPONSE_HEADERS = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
]);
const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);
const LOCAL_OLLAMA_PORT = "11434";

function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return false;
    try {
        const parsed = new URL(origin);
        const isLocalHost = parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost");
        const isLocalIp =
            PRIVATE_HOSTS.has(parsed.hostname) ||
            /^10\./.test(parsed.hostname) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(parsed.hostname) ||
            /^192\.168\./.test(parsed.hostname);
        return isLocalHost || isLocalIp;
    } catch {
        return false;
    }
}

function isPrivateHost(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    if (PRIVATE_HOSTS.has(hostname)) return true;

    if (/^(10|127)\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (hostname.endsWith(".local") || hostname === "localhost") return true;

    return false;
}

function isAllowedLocalOllamaTarget(url: URL): boolean {
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!isPrivateHost(url)) return false;
    if (url.port !== LOCAL_OLLAMA_PORT) return false;
    return url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/");
}

function isPrivateOrBlockedHost(url: URL): boolean {
    if (!url.protocol.startsWith("http")) return true;
    return isPrivateHost(url) && !isAllowedLocalOllamaTarget(url);
}

export function createForwardHeaders(requestHeaders: Headers): Headers {
    const forwardHeaders = new Headers();
    const upstreamUserAgent = requestHeaders.get("x-upstream-user-agent");
    requestHeaders.forEach((value, key) => {
        if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
            forwardHeaders.set(key, value);
        }
    });
    forwardHeaders.set("accept-encoding", "identity");
    if (upstreamUserAgent) {
        forwardHeaders.set("user-agent", upstreamUserAgent);
    }
    return forwardHeaders;
}

export function createResponseHeaders(upstreamHeaders: Headers): Record<string, string> {
    const headers: Record<string, string> = {};
    upstreamHeaders.forEach((value, key) => {
        if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
            headers[key] = value;
        }
    });
    headers["cache-control"] = "no-store";
    return headers;
}

export function startProxyServer(port = 4079) {
    const app = new Elysia({ adapter: node() })
        .use(
            cors({
                origin: (request) => {
                    const origin = (request as Request).headers.get("origin");
                    return isAllowedOrigin(origin);
                },
                methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
                allowedHeaders: [
                    "content-type",
                    "authorization",
                    "x-target-url",
                    "x-upstream-user-agent",
                    "accept",
                    "chatgpt-account-id",
                    "originator",
                    "openai-beta",
                ],
            }),
        )
        .all("/proxy", async ({ request }) => {
            const targetUrl = request.headers.get("x-target-url");
            const origin = request.headers.get("origin");
            if (!isAllowedOrigin(origin)) {
                return new Response("Forbidden", { status: 403 });
            }
            if (!targetUrl) {
                return new Response("Missing X-Target-URL header", { status: 400 });
            }

            const forwardHeaders = createForwardHeaders(request.headers);

            let upstreamUrl: URL;
            try {
                upstreamUrl = new URL(targetUrl);
            } catch {
                return new Response("Invalid target URL", { status: 400 });
            }

            if (isPrivateOrBlockedHost(upstreamUrl)) {
                return new Response("Target host blocked", { status: 403 });
            }

            const hasBody = request.method !== "GET" && request.method !== "HEAD";
            const body = hasBody ? await request.arrayBuffer() : undefined;

            try {
                const upstream = await fetch(upstreamUrl, {
                    method: request.method,
                    headers: forwardHeaders,
                    body,
                    redirect: "manual",
                });

                return new Response(upstream.body, {
                    status: upstream.status,
                    statusText: upstream.statusText,
                    headers: createResponseHeaders(upstream.headers),
                });
            } catch {
                return new Response("Upstream fetch failed", { status: 502 });
            }
        })
        .listen(port);

    console.log(`[proxy] running on http://localhost:${port}`);
    return app;
}
