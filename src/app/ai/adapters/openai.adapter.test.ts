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

function createUnreadableErrorResponse(status: number) {
    const bodyAccess = vi.fn();
    const response = new Proxy(new Response(null, { status }), {
        get(target, property) {
            if (property === "body" || property === "text" || property === "json") {
                bodyAccess(property);
                throw new Error(`Response ${String(property)} must not be accessed.`);
            }
            return Reflect.get(target, property, target);
        },
    });
    return { bodyAccess, response };
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (error: unknown) {
        if (error instanceof Error) return error;
        throw new Error("Expected an Error instance.");
    }
    throw new Error("Expected the promise to reject.");
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

    it("omits empty text parts from file-only messages", async () => {
        streamTextMock.mockReturnValueOnce({ textStream: textStream() });
        const adapter = new OpenAIAdapter();

        for await (const _event of adapter.sendMessage(
            [
                {
                    role: "user",
                    content: {
                        text: "",
                        files: [
                            {
                                id: "image-1",
                                name: "photo.png",
                                mimeType: "image/png",
                                size: 4,
                                data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
                            },
                        ],
                    },
                },
            ],
            { credentials: { apiKey: "test-key" } },
        )) {
            expect(_event).toBeDefined();
        }

        expect(streamTextMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                messages: [
                    expect.objectContaining({
                        content: [expect.objectContaining({ type: "image_url" })],
                    }),
                ],
            }),
        );
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

    it("lists usable Codex models in priority order for ChatGPT OAuth credentials", async () => {
        vi.mocked(proxyFetch).mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    models: [
                        {
                            slug: "gpt-5.4-mini",
                            display_name: "GPT-5.4 Mini",
                            visibility: "list",
                            supported_in_api: true,
                            priority: 20,
                        },
                        {
                            slug: "hidden-model",
                            display_name: "Hidden Model",
                            visibility: "hide",
                            supported_in_api: true,
                            priority: 1,
                        },
                        {
                            slug: "unsupported-model",
                            display_name: "Unsupported Model",
                            visibility: "list",
                            supported_in_api: false,
                            priority: 2,
                        },
                        {
                            slug: "gpt-5.5",
                            display_name: "GPT-5.5",
                            visibility: "list",
                            supported_in_api: true,
                            priority: 10,
                        },
                        {
                            slug: "none-model",
                            display_name: "None Model",
                            visibility: "none",
                            supported_in_api: true,
                            priority: 3,
                        },
                        {
                            slug: "missing-eligibility",
                            display_name: "Missing Eligibility",
                        },
                        {
                            slug: " gpt-5.3 ",
                            display_name: " GPT-5.3 ",
                            visibility: "list",
                            supported_in_api: true,
                            priority: 15,
                        },
                        {
                            slug: "bad model",
                            display_name: "Bad Model",
                            visibility: "list",
                            supported_in_api: true,
                            priority: 4,
                        },
                        {
                            slug: "   ",
                            display_name: "Blank Model",
                            visibility: "list",
                            supported_in_api: true,
                            priority: 5,
                        },
                        { id: "legacy-model", name: "Legacy Model" },
                    ],
                }),
                { status: 200 },
            ),
        );

        const adapter = new OpenAIAdapter();
        await expect(
            adapter.listModels({
                accessToken: "oauth-token",
                accountId: "chatgpt-account-id",
            }),
        ).resolves.toEqual([
            { id: "gpt-5.5", name: "GPT-5.5" },
            { id: "gpt-5.3", name: "GPT-5.3" },
            { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
        ]);

        expect(proxyFetch).toHaveBeenCalledWith(
            "https://chatgpt.com/backend-api/codex/models?client_version=0.145.0",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer oauth-token",
                    "ChatGPT-Account-Id": "chatgpt-account-id",
                    originator: "codex_cli_rs",
                    "OpenAI-Beta": "responses=experimental",
                    "x-upstream-user-agent": "codex_cli_rs/0.145.0",
                }),
            }),
        );
    });

    it("returns no fallback model when the Codex backend reports no models", async () => {
        vi.mocked(proxyFetch).mockResolvedValueOnce(
            new Response(JSON.stringify({ models: [] }), {
                status: 200,
            }),
        );

        const adapter = new OpenAIAdapter();
        await expect(
            adapter.listModels({
                accessToken: "oauth-token",
                accountId: "chatgpt-account-id",
            }),
        ).resolves.toEqual([]);
    });

    it("does not read or expose Codex error response bodies", async () => {
        const { bodyAccess, response } = createUnreadableErrorResponse(400);
        vi.mocked(proxyFetch).mockResolvedValueOnce(response);

        const adapter = new OpenAIAdapter();
        const error = await captureError(
            adapter.listModels({
                accessToken: "expired-token",
                accountId: "chatgpt-account-id",
            }),
        );

        expect(error.message).toBe("OpenAI model request failed (400).");
        expect(bodyAccess).not.toHaveBeenCalled();
    });

    it("lists supported OpenAI API models", async () => {
        vi.mocked(proxyFetch).mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    data: [{ id: "gpt-5" }, { id: "o3-mini" }, { id: "text-embedding-3-small" }],
                }),
                { status: 200 },
            ),
        );

        const adapter = new OpenAIAdapter();
        await expect(adapter.listModels({ apiKey: "platform-key" })).resolves.toEqual([
            { id: "gpt-5", name: "gpt-5" },
            { id: "o3-mini", name: "o3-mini" },
        ]);
        expect(proxyFetch).toHaveBeenCalledWith(
            "https://api.openai.com/v1/models",
            expect.objectContaining({
                headers: { Authorization: "Bearer platform-key" },
            }),
        );
    });

    it("returns no models when the OpenAI API reports an empty model list", async () => {
        vi.mocked(proxyFetch).mockResolvedValueOnce(
            new Response(JSON.stringify({ data: [] }), {
                status: 200,
            }),
        );

        const adapter = new OpenAIAdapter();
        await expect(adapter.listModels({ apiKey: "platform-key" })).resolves.toEqual([]);
    });

    it("does not read or expose OpenAI API error response bodies", async () => {
        const { bodyAccess, response } = createUnreadableErrorResponse(403);
        vi.mocked(proxyFetch).mockResolvedValueOnce(response);

        const adapter = new OpenAIAdapter();
        const error = await captureError(adapter.listModels({ apiKey: "platform-key" }));

        expect(error.message).toBe("OpenAI model request failed (403).");
        expect(bodyAccess).not.toHaveBeenCalled();
    });
});
