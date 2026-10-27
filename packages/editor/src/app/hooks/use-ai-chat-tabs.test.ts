import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIChat } from "@/store/repositories/electron/ai.repository";
import type { Tab } from "@/store/repositories/entities/tab";
import { AI_CHAT_TAB_TYPE, NOTE_TAB_TYPE } from "@/lib/tab-target";
import { AI_CHATS_CHANGED_EVENT } from "@/app/ai/events";
import { useAiChatTabs } from "./use-ai-chat-tabs";

const mocks = vi.hoisted(() => ({ getChats: vi.fn(), supportsAI: vi.fn(() => true) }));
vi.mock("@/store/repositories", () => ({ repositories: { ai: { getChats: mocks.getChats } } }));
vi.mock("@/lib/platform", () => ({ supportsAI: mocks.supportsAI }));
vi.mock("@/app/ai/workspace-context", () => ({ getWorkspaceChatScope: (directory: string | null) => directory ?? "local" }));

function tab(id: string, type = AI_CHAT_TAB_TYPE): Tab {
    return { id: `tab-${id}`, noteId: id, type, project: "local", order: 0,
        createdAt: new Date(), updatedAt: new Date(), scrollY: 0 };
}
function chat(id: string, title = id): AIChat {
    return { id, title, createdAt: new Date().toISOString() };
}
function deferred<T>() {
    let resolve = (_value: T): void => {};
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}
function changed(): void { window.dispatchEvent(new Event(AI_CHATS_CHANGED_EVENT)); }

beforeEach(() => {
    mocks.supportsAI.mockReturnValue(true);
    mocks.getChats.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("shared AI tab metadata", () => {
    it("shares the initial request and one invalidation request across consumers", async () => {
        const pending = deferred<AIChat[]>();
        mocks.getChats.mockReturnValueOnce(pending.promise);
        const tabs = [tab("chat")];
        const { result } = renderHook(() => ({ first: useAiChatTabs(null, tabs), second: useAiChatTabs(null, tabs) }));
        await waitFor(() => expect(mocks.getChats).toHaveBeenCalledTimes(1));
        await act(async () => { pending.resolve([chat("chat", "First title"), chat("unopened")]); await pending.promise; });
        expect(result.current.first.get("chat")?.title).toBe("First title");
        expect(result.current.second.get("chat")?.title).toBe("First title");
        expect(result.current.first.has("unopened")).toBe(false);
        mocks.getChats.mockResolvedValueOnce([chat("chat", "Renamed")]);
        act(changed);
        await waitFor(() => expect(result.current.second.get("chat")?.title).toBe("Renamed"));
        expect(mocks.getChats).toHaveBeenCalledTimes(2);
    });

    it("does not refetch for note-tab changes or tab reordering", async () => {
        mocks.getChats.mockResolvedValue([chat("one"), chat("two")]);
        const { result, rerender } = renderHook(({ tabs }) => useAiChatTabs(null, tabs), {
            initialProps: { tabs: [tab("one"), tab("two")] },
        });
        await waitFor(() => expect(result.current.size).toBe(2));
        rerender({ tabs: [tab("note", NOTE_TAB_TYPE), tab("two"), tab("one")] });
        expect(result.current.size).toBe(2);
        expect(mocks.getChats).toHaveBeenCalledTimes(1);
    });

    it("ignores results for an obsolete AI-tab set", async () => {
        const first = deferred<AIChat[]>();
        const second = deferred<AIChat[]>();
        mocks.getChats.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result, rerender } = renderHook(({ tabs }) => useAiChatTabs(null, tabs), {
            initialProps: { tabs: [tab("first")] },
        });
        await waitFor(() => expect(mocks.getChats).toHaveBeenCalledTimes(1));
        rerender({ tabs: [tab("second")] });
        await waitFor(() => expect(mocks.getChats).toHaveBeenCalledTimes(2));
        await act(async () => { second.resolve([chat("second")]); await second.promise; });
        expect(result.current.has("second")).toBe(true);
        await act(async () => { first.resolve([chat("first")]); await first.promise; });
        expect([...result.current.keys()]).toEqual(["second"]);
    });

    it("does not let an old refresh overwrite a newer response", async () => {
        const first = deferred<AIChat[]>();
        const second = deferred<AIChat[]>();
        mocks.getChats.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result } = renderHook(() => useAiChatTabs(null, [tab("chat")]));
        await waitFor(() => expect(mocks.getChats).toHaveBeenCalledTimes(1));
        act(changed);
        await waitFor(() => expect(mocks.getChats).toHaveBeenCalledTimes(2));
        await act(async () => { second.resolve([chat("chat", "New")]); await second.promise; });
        await act(async () => { first.resolve([chat("chat", "Old")]); await first.promise; });
        expect(result.current.get("chat")?.title).toBe("New");
    });

    it("keeps metadata scoped to the current workspace", async () => {
        const second = deferred<AIChat[]>();
        mocks.getChats.mockResolvedValueOnce([chat("chat", "First workspace")]).mockReturnValueOnce(second.promise);
        const { result, rerender } = renderHook(({ directory }) => useAiChatTabs(directory, [tab("chat")]), {
            initialProps: { directory: "/first" },
        });
        await waitFor(() => expect(result.current.get("chat")?.title).toBe("First workspace"));
        rerender({ directory: "/second" });
        expect(result.current.size).toBe(0);
        await waitFor(() => expect(mocks.getChats).toHaveBeenCalledWith("/second"));
        await act(async () => { second.resolve([chat("chat", "Second workspace")]); await second.promise; });
        expect(result.current.get("chat")?.title).toBe("Second workspace");
    });

    it("keeps loaded titles on a failed refresh, reports the error once, and recovers", async () => {
        mocks.getChats.mockResolvedValueOnce([chat("chat", "Known title")]);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { result } = renderHook(() => ({ first: useAiChatTabs(null, [tab("chat")]), second: useAiChatTabs(null, [tab("chat")]) }));
        await waitFor(() => expect(result.current.first.size).toBe(1));
        mocks.getChats.mockRejectedValueOnce(new Error("Unavailable"));
        act(changed);
        await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
        expect(result.current.first.get("chat")?.title).toBe("Known title");
        expect(result.current.second.get("chat")?.title).toBe("Known title");
        mocks.getChats.mockResolvedValueOnce([chat("chat", "Recovered")]);
        act(changed);
        await waitFor(() => expect(result.current.first.get("chat")?.title).toBe("Recovered"));
    });

    it("releases listeners after the last consumer leaves but retains them for remaining consumers", async () => {
        mocks.getChats.mockResolvedValue([chat("chat")]);
        const first = renderHook(() => useAiChatTabs(null, [tab("chat")]));
        const second = renderHook(() => useAiChatTabs(null, [tab("chat")]));
        await waitFor(() => expect(second.result.current.size).toBe(1));
        first.unmount();
        mocks.getChats.mockResolvedValueOnce([chat("chat", "Still subscribed")]);
        act(changed);
        await waitFor(() => expect(second.result.current.get("chat")?.title).toBe("Still subscribed"));
        second.unmount();
        await act(async () => { changed(); });
        expect(mocks.getChats).toHaveBeenCalledTimes(2);
    });

    it("does not load metadata for disabled AI or note-only tabs", async () => {
        const { rerender } = renderHook(({ tabs }) => useAiChatTabs(null, tabs), {
            initialProps: { tabs: [tab("note", NOTE_TAB_TYPE)] },
        });
        mocks.supportsAI.mockReturnValue(false);
        rerender({ tabs: [tab("chat")] });
        await act(async () => { changed(); });
        expect(mocks.getChats).not.toHaveBeenCalled();
    });
});
