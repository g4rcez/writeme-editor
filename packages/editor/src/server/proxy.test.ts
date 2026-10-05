import { describe, expect, it } from "vitest";
import { createForwardHeaders, createResponseHeaders } from "./proxy";

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
