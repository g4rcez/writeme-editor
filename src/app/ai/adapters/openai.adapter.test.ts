import { describe, expect, it, vi } from "vitest";
import { proxyFetch } from "@/lib/proxy-fetch";
import { createCodexRequestBody, OpenAIAdapter } from "./openai.adapter";

const { streamTextMock, stepCountIsMock, openAIChatMock, openAIResponsesMock } = vi.hoisted(() => ({
    streamTextMock: vi.fn(),
    stepCountIsMock: vi.fn((count: number) => ({
        type: "step-count",
        count,
    })),
    openAIChatMock: vi.fn((model: string) => ({
        provider: "openai.chat",
        model,
    })),
    openAIResponsesMock: vi.fn((model: string) => ({
        provider: "openai.responses",
        model,
    })),
}));

vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: vi.fn(() => ({
        chat: openAIChatMock,
        responses: openAIResponsesMock,
    })),
}));

vi.mock("ai", () => ({
    streamText: streamTextMock,
    stepCountIs: stepCountIsMock,
}));

vi.mock("@/lib/proxy-fetch", () => ({
    proxyFetch: vi.fn(),
}));

async function* textStream(): AsyncGenerator<string> {
    yield "ok";
}

function createJwt(payload: object): string {
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return `header.${encodedPayload}.signature`;
}

describe("createCodexRequestBody", () => {
    it("moves developer input into top-level instructions for Codex", () => {
        const body = createCodexRequestBody(
            JSON.stringify({
                model: "gpt-5.4-mini",
                input: [
                    { role: "developer", content: "Use readable markdown." },
                    {
                        role: "user",
                        content: [{ type: "input_text", text: "What is my name?" }],
                    },
                ],
                store: true,
                stream: false,
            }),
        );

        const parsed = JSON.parse(body) as {
            instructions: string;
            input: Array<{ role: string }>;
            store: boolean;
            stream: boolean;
        };

        expect(parsed.instructions).toBe("Use readable markdown.");
        expect(parsed.input).toEqual([expect.objectContaining({ role: "user" })]);
        expect(parsed.store).toBe(false);
        expect(parsed.stream).toBe(true);
    });

    it("adds fallback instructions when the SDK omits them", () => {
        const body = createCodexRequestBody(
            JSON.stringify({ model: "gpt-5.4-mini", input: [] }),
            "Fallback instructions",
        );

        expect(JSON.parse(body)).toEqual(expect.objectContaining({ instructions: "Fallback instructions" }));
    });
});

describe("OpenAIAdapter", () => {
    it("uses OpenAI chat completions for platform API keys", async () => {
        streamTextMock.mockReturnValueOnce({ textStream: textStream() });

        const adapter = new OpenAIAdapter();
        const events = [];

        for await (const event of adapter.sendMessage([{ role: "user", content: { text: "List my notes" } }], {
            credentials: { apiKey: "test-key" },
            tools: {},
        })) {
            events.push(event);
        }

        expect(events).toEqual([{ type: "text", delta: "ok" }, { type: "done" }]);
        expect(openAIChatMock).toHaveBeenCalledWith("gpt-4o");
        expect(streamTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                model: {
                    provider: "openai.chat",
                    model: "gpt-4o",
                },
                providerOptions: {
                    openai: {
                        store: false,
                    },
                },
            }),
        );
        expect(stepCountIsMock).toHaveBeenCalledWith(5);
    });

    it("routes ChatGPT OAuth credentials to the Codex responses backend", async () => {
        streamTextMock.mockReturnValueOnce({ textStream: textStream() });

        const adapter = new OpenAIAdapter();
        const events = [];

        for await (const event of adapter.sendMessage([{ role: "user", content: { text: "Hello" } }], {
            credentials: {
                accessToken: "oauth-token",
                refreshToken: "refresh-token",
                accountId: "chatgpt-account-id",
                apiKey: "stale-platform-key",
            },
            model: "gpt-5.4-mini",
        })) {
            events.push(event);
        }

        expect(events).toEqual([{ type: "text", delta: "ok" }, { type: "done" }]);
        expect(openAIResponsesMock).toHaveBeenCalledWith("gpt-5.4-mini");
        expect(streamTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                model: {
                    provider: "openai.responses",
                    model: "gpt-5.4-mini",
                },
                temperature: undefined,
                maxOutputTokens: undefined,
            }),
        );
    });

    it("derives the Codex account ID from older saved OAuth access tokens", async () => {
        streamTextMock.mockReturnValueOnce({ textStream: textStream() });
        const accessToken = createJwt({
            "https://api.openai.com/auth": {
                chatgpt_account_id: "derived-chatgpt-account-id",
            },
        });

        const adapter = new OpenAIAdapter();
        const events = [];

        for await (const event of adapter.sendMessage([{ role: "user", content: { text: "Hello" } }], {
            credentials: {
                accessToken,
                refreshToken: "refresh-token",
                apiKey: "stale-platform-key",
            },
            model: "gpt-5.4-mini",
        })) {
            events.push(event);
        }

        expect(events).toEqual([{ type: "text", delta: "ok" }, { type: "done" }]);
        expect(openAIResponsesMock).toHaveBeenLastCalledWith("gpt-5.4-mini");
    });

    it("lists Codex backend models for ChatGPT OAuth credentials", async () => {
        vi.mocked(proxyFetch).mockResolvedValueOnce(
            new Response(JSON.stringify({ models: [{ slug: "gpt-5.4-mini" }] }), {
                status: 200,
            }),
        );

        const adapter = new OpenAIAdapter();
        await expect(
            adapter.listModels({
                accessToken: "oauth-token",
                accountId: "chatgpt-account-id",
            }),
        ).resolves.toEqual([{ id: "gpt-5.4-mini", name: "gpt-5.4-mini" }]);

        expect(proxyFetch).toHaveBeenCalledWith(
            "https://chatgpt.com/backend-api/codex/models?client_version=writeme",
            expect.objectContaining({
                headers: expect.objectContaining({
                    "ChatGPT-Account-Id": "chatgpt-account-id",
                    originator: "codex_cli_rs",
                    "OpenAI-Beta": "responses=experimental",
                    "x-upstream-user-agent": "codex_cli_rs/0.0.1",
                }),
            }),
        );
    });
});
