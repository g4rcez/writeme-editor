import { describe, expect, it, vi } from "vitest";

import { proxyFetch } from "@/lib/proxy-fetch";
import { OllamaAdapter } from "./ollama.adapter";

vi.mock("@/lib/proxy-fetch", () => ({
  proxyFetch: vi.fn(),
}));

const mockedProxyFetch = vi.mocked(proxyFetch);

describe("OllamaAdapter", () => {
  it("loads running models from /api/ps on the configured base URL host", async () => {
    mockedProxyFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [{ name: "llama3.2:latest", model: "llama3.2" }],
        }),
        { status: 200 },
      ),
    );

    const models = await new OllamaAdapter().listModels({
      baseUrl: "http://localhost:11434/v1",
    });

    expect(mockedProxyFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/ps",
      { headers: {} },
    );
    expect(models).toEqual([
      { id: "llama3.2", name: "llama3.2:latest", contextWindow: undefined },
    ]);
  });

  it("keeps custom base URL paths when resolving /api/ps", async () => {
    mockedProxyFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );

    await new OllamaAdapter().listModels({
      baseUrl: "https://example.com/ollama/v1",
      apiKey: "token",
    });

    expect(mockedProxyFetch).toHaveBeenCalledWith(
      "https://example.com/ollama/api/ps",
      { headers: { Authorization: "Bearer token" } },
    );
  });
});
