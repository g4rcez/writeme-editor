import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxyFetch } from "@/lib/proxy-fetch";
import { OllamaAdapter } from "./ollama.adapter";

vi.mock("@/lib/proxy-fetch", () => ({
    proxyFetch: vi.fn(),
}));

const mockedProxyFetch = vi.mocked(proxyFetch);

describe("OllamaAdapter", () => {
    beforeEach(() => {
        mockedProxyFetch.mockReset();
    });

    it("loads available models from /api/tags on the configured base URL host", async () => {
        mockedProxyFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    models: [
                        {
                            name: "llama3.2:latest",
                            model: "llama3.2",
                            details: { context_length: 4096 },
                        },
                    ],
                }),
                { status: 200 },
            ),
        );

        const models = await new OllamaAdapter().listModels({
            baseUrl: "http://localhost:11434/v1",
        });

        expect(mockedProxyFetch).toHaveBeenCalledWith("http://localhost:11434/api/tags", { headers: {} });
        expect(models).toEqual([{ id: "llama3.2", name: "llama3.2:latest", contextWindow: 4096 }]);
    });

    it("keeps custom base URL paths when resolving /api/tags", async () => {
        mockedProxyFetch.mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }));

        await new OllamaAdapter().listModels({
            baseUrl: "https://example.com/ollama/v1",
            apiKey: "token",
        });

        expect(mockedProxyFetch).toHaveBeenCalledWith("https://example.com/ollama/api/tags", {
            headers: { Authorization: "Bearer token" },
        });
    });
});
