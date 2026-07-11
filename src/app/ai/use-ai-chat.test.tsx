import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig, AIChat } from "@/store/repositories/electron/ai.repository";
import type { AIStreamEvent } from "./adapters/types";
import { useAIChat } from "./use-ai-chat";

const mocks = vi.hoisted(() => {
    let uuidCounter = 0;

    return {
        resetUuid: () => {
            uuidCounter = 0;
        },
        uuid: vi.fn(() => {
            uuidCounter += 1;
            return `uuid-${uuidCounter}`;
        }),
        aiRepository: {
            getChats: vi.fn(),
            saveChat: vi.fn(),
            getMessages: vi.fn(),
            getConfigs: vi.fn(),
            saveMessage: vi.fn(),
            clearMessages: vi.fn(),
        },
        adapter: {
            sendMessage: vi.fn(),
        },
        adapterRegistryGet: vi.fn(),
        getCredentials: vi.fn(),
    };
});

vi.mock("uuid", () => ({
    v7: mocks.uuid,
}));

vi.mock("../../store/global.store", () => ({
    repositories: {
        ai: mocks.aiRepository,
    },
}));

vi.mock("./adapters/registry", () => ({
    adapterRegistry: {
        get: mocks.adapterRegistryGet,
    },
}));

vi.mock("./auth/auth-manager", () => ({
    authManager: {
        getCredentials: mocks.getCredentials,
    },
}));

function createStream(events: AIStreamEvent[]): AsyncIterable<AIStreamEvent> {
    return (async function* streamEvents() {
        for (const event of events) {
            yield event;
        }
    })();
}

describe("useAIChat", () => {
    const chat = {
        id: "chat-1",
        noteId: "workspace:test",
        title: "Workspace chat",
        createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies AIChat;

    const config = {
        id: "config-1",
        name: "Default",
        systemPrompt: "",
        isDefault: true,
        adapterId: "openai",
        model: "gpt-test",
    } satisfies AIConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resetUuid();
        mocks.aiRepository.getChats.mockResolvedValue([chat]);
        mocks.aiRepository.getMessages.mockResolvedValue([]);
        mocks.aiRepository.getConfigs.mockResolvedValue([config]);
        mocks.aiRepository.saveMessage.mockResolvedValue(undefined);
        mocks.aiRepository.saveChat.mockResolvedValue(undefined);
        mocks.adapterRegistryGet.mockReturnValue(mocks.adapter);
        mocks.getCredentials.mockResolvedValue({ apiKey: "test-key" });
        mocks.adapter.sendMessage.mockReturnValue(
            createStream([{ type: "text", delta: "Hello" }, { type: "text", delta: " back" }, { type: "done" }]),
        );
    });

    it("appends and persists streamed assistant text", async () => {
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sent = false;
        await act(async () => {
            sent = await result.current.send("Hello", {
                selection: "",
                context: "Workspace context",
            });
        });

        expect(sent).toBe(true);
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[0]).toMatchObject({
            role: "user",
            content: "Hello",
        });
        expect(result.current.messages[1]).toMatchObject({
            role: "assistant",
            content: "Hello back",
        });
        expect(mocks.aiRepository.saveMessage).toHaveBeenCalledWith(
            expect.objectContaining({ role: "assistant", content: "Hello back" }),
        );
    });

    it("does not send when config is unavailable", async () => {
        mocks.aiRepository.getConfigs.mockResolvedValue([]);
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sent = true;
        await act(async () => {
            sent = await result.current.send("Hello", {
                selection: "",
                context: "Workspace context",
            });
        });

        expect(sent).toBe(false);
        expect(result.current.messages).toEqual([]);
        expect(mocks.adapter.sendMessage).not.toHaveBeenCalled();
    });

    it("shows stream errors as system messages", async () => {
        mocks.adapter.sendMessage.mockReturnValue(createStream([{ type: "error", message: "Provider failed" }]));
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sent = true;
        await act(async () => {
            sent = await result.current.send("Hello", {
                selection: "",
                context: "Workspace context",
            });
        });

        expect(sent).toBe(true);
        expect(result.current.messages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "system",
                    content: "Error: Provider failed",
                }),
            ]),
        );
        expect(mocks.aiRepository.saveMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                role: "system",
                content: "Error: Provider failed",
            }),
        );
    });
});
