import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";

const STRIPPED_HEADERS = new Set(["host", "origin", "referer", "x-target-url"]);

export function startProxyServer(port = 4079) {
  const app = new Elysia({ adapter: node() })
    .use(cors())
    .all("/proxy", async ({ request }) => {
      const targetUrl = request.headers.get("x-target-url");
      if (!targetUrl) {
        return new Response("Missing X-Target-URL header", { status: 400 });
      }

      const forwardHeaders = new Headers();
      request.headers.forEach((value, key) => {
        if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
          forwardHeaders.set(key, value);
        }
      });

      const hasBody = request.method !== "GET" && request.method !== "HEAD";

      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: hasBody ? request.body : undefined,
        redirect: "manual",
        // @ts-ignore -- required for streaming request bodies in Node.js
        duplex: "half",
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      });
    })
    .listen(port);

  console.log(`[proxy] running on http://localhost:${port}`);
  return app;
}
