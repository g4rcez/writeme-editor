import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";

const STRIPPED_HEADERS = new Set(["host", "origin", "referer", "x-target-url"]);
const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost");
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

function isPrivateOrBlockedHost(url: URL): boolean {
  if (!url.protocol.startsWith("http")) return true;

  const hostname = url.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(hostname)) return true;

  if (/^(10|127)\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (hostname.endsWith(".local") || hostname === "localhost") return true;

  return false;
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
          "accept",
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

      const forwardHeaders = new Headers();
      request.headers.forEach((value, key) => {
        if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
          forwardHeaders.set(key, value);
        }
      });

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

      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: hasBody ? request.body : undefined,
        redirect: "manual",
        // @ts-expect-error -- required for streaming request bodies in Node.js
        duplex: "half",
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          ...Object.fromEntries(upstream.headers),
          "cache-control": "no-store",
        },
      });
    })
    .listen(port);

  console.log(`[proxy] running on http://localhost:${port}`);
  return app;
}
