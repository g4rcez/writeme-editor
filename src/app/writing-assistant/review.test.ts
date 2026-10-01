import { afterEach, describe, expect, it, vi } from "vitest";
import { adapterRegistry } from "@/app/ai/adapters/registry";
import type { AIAdapter, AIStreamEvent, AuthCredentials } from "@/app/ai/adapters/types";
import { authManager } from "@/app/ai/auth/auth-manager";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import { reviewWriting } from "./review";
import type { WritingSegment } from "./types";

const config: AIConfig = {
    id: "writing-config",
    name: "Writing review test",
    systemPrompt: "A conflicting saved instruction that must not be used",
    isDefault: true,
    adapterId: "writing-test-provider",
    model: "writing-model",
    baseUrl: "https://provider.example.test",
    commandTemplate: "must-not-run",
};

const segment = (id: string, text: string, from = 0): WritingSegment => ({ id, text, from, to: from + text.length });

function setupAdapter(
    stream: AIAdapter["sendMessage"],
): { adapter: AIAdapter } {
    const adapter: AIAdapter = {
        id: config.adapterId,
        name: "Test provider",
        supportsFiles: false,
        fileCapabilities: { kinds: [], accept: "" },
        supportsOAuth: false,
        defaultModel: "default-model",
        auth: async () => ({}),
        refresh: async () => ({}),
        isExpired: () => false,
        listModels: async () => [],
        prepareFile: async () => {
            throw new Error("Writing review must not prepare files.");
        },
        sendMessage: vi.fn(stream),
    };
    vi.spyOn(adapterRegistry, "get").mockReturnValue(adapter);
    vi.spyOn(authManager, "getCredentials").mockResolvedValue({ apiKey: "synthetic-test-key" });
    return { adapter };
}

function jsonStream(response: string): AIAdapter["sendMessage"] {
    return async function*() {
        yield { type: "text", delta: response.slice(0, Math.floor(response.length / 2)) };
        yield { type: "text", delta: response.slice(Math.floor(response.length / 2)) };
        yield { type: "done" };
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("writing review provider contract", () => {
    it("targets the requested duplicate occurrence and preserves UTF-16 offsets", async () => {
        const { adapter } = setupAdapter(
            jsonStream(
                JSON.stringify({
                    suggestions: [
                        {
                            segmentId: "passage",
                            from: 7,
                            to: 9,
                            original: "go",
                            replacement: "walk",
                            category: "clarity",
                            explanation: "A more specific verb.",
                        },
                    ],
                }),
            ),
        );

        const suggestions = await reviewWriting(
            config,
            [segment("passage", "😀 go; go", 40)],
            new AbortController().signal,
        );

        expect(suggestions).toMatchObject([
            {
                segmentId: "passage",
                from: 7,
                to: 9,
                original: "go",
                replacement: "walk",
                category: "clarity",
            },
        ]);
        expect(suggestions[0]?.id).toBeTruthy();
        const sendMessage = vi.mocked(adapter.sendMessage);
        const [messages, options] = sendMessage.mock.calls[0] ?? [];
        expect(messages?.[0]?.content.text).toBe(JSON.stringify({ segments: [{ id: "passage", text: "😀 go; go" }] }));
        expect(options).toMatchObject({
            model: "writing-model",
            baseUrl: "https://provider.example.test",
            systemPrompt: expect.stringContaining("never translate"),
            toolChoice: "none",
        });
        expect(options?.systemPrompt).not.toContain(config.systemPrompt);
        expect(options?.commandTemplate).toBeUndefined();
    });

    it("rejects malformed output and offsets that split a surrogate pair", async () => {
        setupAdapter(jsonStream("{\"suggestions\":["));
        await expect(reviewWriting(config, [segment("passage", "typo")], new AbortController().signal)).rejects.toThrow(
            "The provider returned suggestions that could not be safely applied. Try reviewing again.",
        );

        const invalid = JSON.stringify({
            suggestions: [
                {
                    segmentId: "passage",
                    from: 1,
                    to: 2,
                    original: "�",
                    replacement: "x",
                    category: "spelling",
                    explanation: "A correction.",
                },
            ],
        });
        setupAdapter(jsonStream(invalid));
        await expect(reviewWriting(config, [segment("passage", "😀 typo")], new AbortController().signal)).rejects.toThrow(
            "The provider returned suggestions that could not be safely applied. Try reviewing again.",
        );
    });

    it("deduplicates findings and keeps the first source-ordered non-overlapping issue", async () => {
        const response = JSON.stringify({
            suggestions: [
                {
                    segmentId: "passage",
                    from: 1,
                    to: 4,
                    original: "bcd",
                    replacement: "x",
                    category: "clarity",
                    explanation: "First overlapping issue.",
                },
                {
                    segmentId: "passage",
                    from: 1,
                    to: 4,
                    original: "bcd",
                    replacement: "x",
                    category: "clarity",
                    explanation: "First overlapping issue.",
                },
                {
                    segmentId: "passage",
                    from: 3,
                    to: 5,
                    original: "de",
                    replacement: "y",
                    category: "grammar",
                    explanation: "Overlaps the first issue.",
                },
                {
                    segmentId: "passage",
                    from: 4,
                    to: 5,
                    original: "e",
                    replacement: "z",
                    category: "enhancement",
                    explanation: "Touches but does not overlap the first issue's end.",
                },
            ],
        });
        setupAdapter(jsonStream(response));

        const suggestions = await reviewWriting(config, [segment("passage", "abcdef")], new AbortController().signal);

        expect(suggestions.map(({ from, to, replacement }) => ({ from, to, replacement }))).toEqual([
            { from: 1, to: 4, replacement: "x" },
            { from: 4, to: 5, replacement: "z" },
        ]);
    });

    it("keeps a multi-batch review unpublished when a later batch fails", async () => {
        const progress: Array<[number, number]> = [];
        let call = 0;
        const { adapter } = setupAdapter(async function*(): AsyncIterable<AIStreamEvent> {
            call += 1;
            if (call === 1) {
                yield { type: "text", delta: '{"suggestions":[]}' };
                yield { type: "done" };
                return;
            }
            yield { type: "error", message: "Provider request failed." };
        });
        const sendMessage = vi.mocked(adapter.sendMessage);
        await expect(
            reviewWriting(
                config,
                [segment("first", "a".repeat(4_000)), segment("second", "b".repeat(4_000)), segment("third", "c".repeat(1))],
                new AbortController().signal,
                (current, total) => progress.push([current, total]),
            ),
        ).rejects.toThrow("Provider request failed.");

        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(progress).toEqual([
            [1, 2],
            [2, 2],
        ]);
    });

    it("rejects CLI before credential access or provider send", async () => {
        const credentialLoad = vi.spyOn(authManager, "getCredentials");
        const providerLookup = vi.spyOn(adapterRegistry, "get");
        const cliConfig = { ...config, adapterId: "cli" };

        await expect(reviewWriting(cliConfig, [segment("passage", "hello")], new AbortController().signal)).rejects.toThrow(
            "Writing review requires an HTTP AI provider. Choose another configuration in AI settings.",
        );

        expect(credentialLoad).not.toHaveBeenCalled();
        expect(providerLookup).not.toHaveBeenCalled();
    });

    it("does not send after credentials finish loading for an aborted request", async () => {
        const credentials = Promise.withResolvers<AuthCredentials>();
        const { adapter } = setupAdapter(jsonStream('{"suggestions":[]}'));
        const credentialLoad = vi.mocked(authManager.getCredentials);
        const sendMessage = vi.mocked(adapter.sendMessage);
        credentialLoad.mockReturnValue(credentials.promise);
        const controller = new AbortController();
        const pending = reviewWriting(config, [segment("passage", "hello")], controller.signal);

        controller.abort();
        credentials.resolve({ apiKey: "synthetic-test-key" });

        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("does not publish a done event emitted after abort", async () => {
        const controller = new AbortController();
        const { adapter } = setupAdapter(async function*(): AsyncIterable<AIStreamEvent> {
            yield { type: "text", delta: '{"suggestions":[]}' };
            yield { type: "done" };
            controller.abort();
        });
        const sendMessage = vi.mocked(adapter.sendMessage);
        await expect(reviewWriting(config, [segment("passage", "hello")], controller.signal)).rejects.toMatchObject({
            name: "AbortError",
        });
        expect(sendMessage).toHaveBeenCalledOnce();
    });
});
