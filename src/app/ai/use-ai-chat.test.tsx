import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig, AIChat, AIMessage } from "@/store/repositories/electron/ai.repository";
import { AI_ATTACHMENT_LIMITS, type AIConversationMessage, type AIFile, type AIStreamEvent } from "./adapters/types";
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
            supportsFiles: true,
            fileCapabilities: { kinds: ["image", "pdf", "text"], accept: "" },
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
        for (const event of events) yield event;
    })();
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
}

function createPdfFile(id = "file-1", name = "research.pdf"): AIFile {
    const bytes = new TextEncoder().encode("%PDF-1.7\n");
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return { id, name, mimeType: "application/pdf", size: data.byteLength, data };
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
        mocks.adapter.sendMessage.mockImplementation(() =>
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

    it("persists attachment metadata, sends binary payloads, and titles file-only chats", async () => {
        mocks.aiRepository.getChats.mockResolvedValue([{ ...chat, title: "New Chat" }]);
        const file = createPdfFile();
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sent = false;
        await act(async () => {
            sent = await result.current.send("", { selection: "", context: "" }, [file]);
        });

        expect(sent).toBe(true);
        expect(mocks.aiRepository.saveMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                role: "user",
                content: "",
                files: [
                    {
                        id: "file-1",
                        name: "research.pdf",
                        mimeType: "application/pdf",
                        size: file.size,
                    },
                ],
            }),
        );
        expect(mocks.aiRepository.saveChat).toHaveBeenCalledWith(expect.objectContaining({ title: "research.pdf" }));
        expect(mocks.adapter.sendMessage).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "user",
                    content: expect.objectContaining({ text: "", files: [file] }),
                }),
            ]),
            expect.any(Object),
            expect.any(AbortSignal),
        );
    });

    it("reuses cached attachment bytes on a follow-up turn", async () => {
        const file = createPdfFile();
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.send("Review this", { selection: "", context: "" }, [file]);
        });
        await act(async () => {
            await result.current.send("What changed?", { selection: "", context: "" });
        });

        const followUpHistory = mocks.adapter.sendMessage.mock.calls[1]?.[0] as Array<{
            role: string;
            content: { text: string; files?: AIFile[] };
        }>;
        expect(followUpHistory).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "user",
                    content: expect.objectContaining({ text: "Review this", files: [file] }),
                }),
            ]),
        );
    });

    it("uses an honest metadata marker when reloaded attachment bytes are unavailable", async () => {
        const file = createPdfFile();
        mocks.aiRepository.getMessages.mockResolvedValue([
            {
                id: "previous-user",
                chatId: chat.id,
                role: "user",
                content: "",
                createdAt: "2026-01-01T00:00:00.000Z",
                files: [{ id: file.id, name: file.name, mimeType: file.mimeType, size: file.size }],
            },
        ]);
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.send("Continue", { selection: "", context: "" });
        });

        const history = mocks.adapter.sendMessage.mock.calls[0]?.[0] as Array<{
            content: { text: string; files?: AIFile[] };
        }>;
        expect(history[0]?.content.text).toContain("Attachment metadata only: research.pdf");
        expect(history[0]?.content.files).toBeUndefined();
    });

    it("ignores a deferred message load after the selected chat changes", async () => {
        const otherChat = { ...chat, id: "chat-2", title: "Other chat" };
        let resolveOldMessages!: (messages: AIMessage[]) => void;
        const oldMessages = new Promise<AIMessage[]>((resolve) => {
            resolveOldMessages = resolve;
        });
        const currentMessage = {
            id: "current-message",
            chatId: otherChat.id,
            role: "assistant" as const,
            content: "Current chat content",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        };
        mocks.aiRepository.getChats.mockResolvedValue([chat, otherChat]);
        mocks.aiRepository.getMessages.mockImplementation((chatId: string) =>
            chatId === chat.id ? oldMessages : Promise.resolve([currentMessage]),
        );
        const { result, rerender } = renderHook(
            ({ selectedChat }: { selectedChat: string }) => useAIChat(undefined, "workspace:test", selectedChat),
            { initialProps: { selectedChat: chat.id } },
        );
        await waitFor(() => expect(mocks.aiRepository.getMessages).toHaveBeenCalledWith(chat.id));

        rerender({ selectedChat: otherChat.id });
        await waitFor(() => expect(result.current.chat?.id).toBe(otherChat.id));
        expect(result.current.messages).toEqual([currentMessage]);

        await act(async () => {
            resolveOldMessages([
                {
                    ...currentMessage,
                    id: "stale-message",
                    chatId: chat.id,
                    content: "Stale chat content",
                },
            ]);
            await oldMessages;
        });
        expect(result.current.chat?.id).toBe(otherChat.id);
        expect(result.current.messages).toEqual([currentMessage]);
    });

    it("does not append deferred stream events after switching chats", async () => {
        const otherChat = { ...chat, id: "chat-2", title: "Other chat" };
        const releaseStream = deferred<void>();
        const currentMessage = {
            id: "current-message",
            chatId: otherChat.id,
            role: "assistant" as const,
            content: "Current chat content",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        };
        mocks.aiRepository.getChats.mockResolvedValue([chat, otherChat]);
        mocks.aiRepository.getMessages.mockImplementation(async (chatId: string) =>
            chatId === otherChat.id ? [currentMessage] : [],
        );
        mocks.adapter.sendMessage.mockImplementation(() =>
            (async function* deferredStream() {
                yield { type: "text" as const, delta: "Old" };
                await releaseStream.promise;
                yield { type: "text" as const, delta: " stale" };
                yield { type: "done" as const };
            })(),
        );
        const { result, rerender } = renderHook(
            ({ selectedChat }: { selectedChat: string }) => useAIChat(undefined, "workspace:test", selectedChat),
            { initialProps: { selectedChat: chat.id } },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let pending!: Promise<boolean>;
        act(() => {
            pending = result.current.send("Old question", { selection: "", context: "" });
        });
        await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe("Old"));
        rerender({ selectedChat: otherChat.id });
        await waitFor(() => expect(result.current.chat?.id).toBe(otherChat.id));
        expect(result.current.messages).toEqual([currentMessage]);

        let sent = true;
        await act(async () => {
            releaseStream.resolve();
            sent = await pending;
        });
        expect(sent).toBe(false);
        expect(result.current.messages).toEqual([currentMessage]);
        expect(
            mocks.aiRepository.saveMessage.mock.calls.some(
                ([message]) => message.role === "assistant" && message.content.includes("stale"),
            ),
        ).toBe(false);
    });

    it("aborts and invalidates a stream on unmount after creating a new chat", async () => {
        const releaseStream = deferred<void>();
        let capturedSignal: AbortSignal | undefined;
        mocks.adapter.sendMessage.mockImplementation(
            (_messages: unknown, _options: unknown, signal: AbortSignal | undefined) => {
                capturedSignal = signal;
                return (async function* deferredStream() {
                    yield { type: "text" as const, delta: "Before unmount" };
                    await releaseStream.promise;
                    yield { type: "text" as const, delta: " after unmount" };
                    yield { type: "done" as const };
                })();
            },
        );
        const { result, unmount } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await act(async () => {
            await result.current.newChat();
        });

        let pending!: Promise<boolean>;
        act(() => {
            pending = result.current.send("Question in the new chat", { selection: "", context: "" });
        });
        await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe("Before unmount"));

        unmount();
        expect(capturedSignal?.aborted).toBe(true);
        releaseStream.resolve();
        await expect(pending).resolves.toBe(false);
        expect(
            mocks.aiRepository.saveMessage.mock.calls.some(
                ([message]) => message.role === "assistant" && message.content.includes("after unmount"),
            ),
        ).toBe(false);
    });

    it("evicts attachment bytes by FIFO turn count while retaining metadata", async () => {
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        for (let index = 0; index <= AI_ATTACHMENT_LIMITS.maxCachedTurns; index += 1) {
            await act(async () => {
                await result.current.send(`Turn ${index}`, { selection: "", context: "" }, [
                    createPdfFile(`file-${index}`, `turn-${index}.pdf`),
                ]);
            });
        }
        await act(async () => {
            await result.current.send("Follow up", { selection: "", context: "" });
        });

        const history = mocks.adapter.sendMessage.mock.calls.at(-1)?.[0] as AIConversationMessage[];
        const firstTurn = history.find((message) => message.content.text.includes("Turn 0"));
        const secondTurn = history.find((message) => message.content.text === "Turn 1");
        expect(firstTurn?.content.text).toContain("Attachment metadata only: turn-0.pdf");
        expect(firstTurn?.content.files).toBeUndefined();
        expect(secondTurn?.content.files?.[0]?.name).toBe("turn-1.pdf");

        const persistedAttachmentMessages = mocks.aiRepository.saveMessage.mock.calls
            .map(([message]) => message)
            .filter((message) => message.role === "user" && message.files?.length);
        expect(persistedAttachmentMessages).toHaveLength(AI_ATTACHMENT_LIMITS.maxCachedTurns + 1);
        expect(persistedAttachmentMessages.every((message) => !Object.hasOwn(message.files![0]!, "data"))).toBe(true);
    });

    it("locks duplicate sends before deferred authentication resolves", async () => {
        let resolveCredentials: ((credentials: { apiKey: string }) => void) | undefined;
        mocks.getCredentials.mockReturnValue(
            new Promise((resolve) => {
                resolveCredentials = resolve;
            }),
        );
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let firstSent = false;
        let duplicateSent = true;
        await act(async () => {
            const first = result.current.send("First", { selection: "", context: "" });
            duplicateSent = await result.current.send("Duplicate", { selection: "", context: "" });
            resolveCredentials?.({ apiKey: "test-key" });
            firstSent = await first;
        });

        expect(firstSent).toBe(true);
        expect(duplicateSent).toBe(false);
        expect(mocks.adapter.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("abandons a deferred send when the chat scope changes", async () => {
        let resolveCredentials: ((credentials: { apiKey: string }) => void) | undefined;
        mocks.getCredentials.mockReturnValue(
            new Promise((resolve) => {
                resolveCredentials = resolve;
            }),
        );
        const { result, rerender } = renderHook(({ scope }: { scope: string }) => useAIChat(undefined, scope), {
            initialProps: { scope: "workspace:test" },
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sent = true;
        let pending!: Promise<boolean>;
        act(() => {
            pending = result.current.send("Old scope", { selection: "", context: "" });
        });
        rerender({ scope: "workspace:other" });
        await act(async () => {
            resolveCredentials?.({ apiKey: "test-key" });
            sent = await pending;
        });

        expect(sent).toBe(false);
        expect(mocks.aiRepository.saveMessage).not.toHaveBeenCalled();
        expect(mocks.adapter.sendMessage).not.toHaveBeenCalled();
    });

    it("preserves pending content when authentication rejects the send", async () => {
        mocks.getCredentials.mockRejectedValue(new Error("Not authenticated"));
        const { result } = renderHook(() => useAIChat(undefined, "workspace:test"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sent = true;
        await act(async () => {
            sent = await result.current.send("Keep this", { selection: "", context: "" });
        });

        expect(sent).toBe(false);
        expect(result.current.messages).toEqual([]);
        expect(mocks.aiRepository.saveMessage).not.toHaveBeenCalled();
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
