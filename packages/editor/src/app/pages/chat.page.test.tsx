import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIWorkspaceData } from "@/store/repositories/electron/ai.repository";
import { useGlobalStore } from "@/store/global.store";
import ChatPage from "./chat.page";
const originalScrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

const mocks = vi.hoisted(() => {
    const emptyWorkspaceData = (): AIWorkspaceData => ({ activities: [], sources: [], proposals: [] });
    let workspaceData = emptyWorkspaceData();
    return {
        send: vi.fn<(...args: unknown[]) => Promise<boolean>>(),
        reset: vi.fn(() => {
            workspaceData = emptyWorkspaceData();
        }),
        getWorkspaceData: vi.fn(() => workspaceData),
        setWorkspaceData: (next: AIWorkspaceData) => {
            workspaceData = next;
        },
        turnSnapshots: [] as AIWorkspaceData[],
    };
});

vi.mock("@/store/global.store", () => ({
    getWorkspaceKey: () => "__local__",
    repositories: { ai: {} },
    useGlobalStore: vi.fn(),
}));

vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));
vi.mock("@/lib/storage-mode", () => ({ getStorageMode: () => "browser" }));
vi.mock("@/app/ai/adapters/registry", () => ({ adapterRegistry: { get: () => undefined } }));
vi.mock("@/app/ai/chat-tools", () => ({
    createWorkspaceTools: (onChange?: (data: AIWorkspaceData) => void) => ({
        tools: {},
        reset: () => {
            mocks.reset();
            onChange?.(mocks.getWorkspaceData());
        },
        getWorkspaceData: () => mocks.getWorkspaceData(),
    }),
}));
vi.mock("@/app/ai/use-ai-chat", () => ({
    useAIChat: () => ({
        chat: null,
        messages: [],
        isStreaming: false,
        isLoading: false,
        send: mocks.send,
        cancel: vi.fn(),
        config: {
            id: "config-1",
            name: "Test provider",
            systemPrompt: "",
            isDefault: true,
            adapterId: "openai",
        },
        renameChat: vi.fn(),
    }),
}));
vi.mock("@/app/ai/markdown-chat-composer", () => ({ MarkdownChatComposer: () => <div /> }));

const EMPTY_WORKSPACE_DATA: AIWorkspaceData = { activities: [], sources: [], proposals: [] };
const PRIOR_TURN_DATA: AIWorkspaceData = {
    activities: [{ id: "old-activity", toolName: "searchNotes", label: "Searched old turn", status: "complete" }],
    sources: [{ noteId: "old-note", title: "Old turn source" }],
    proposals: [
        {
            id: "old-proposal",
            noteId: "old-note",
            title: "Old note",
            rationale: "Previous turn proposal",
            baseUpdatedAt: "2026-01-01T00:00:00.000Z",
            baseMarkdown: "Old content",
            proposedMarkdown: "Changed content",
            status: "pending",
            createdAt: "2026-01-01T00:00:00.000Z",
        },
    ],
};
const CURRENT_TURN_DATA: AIWorkspaceData = {
    activities: [{ id: "current-activity", toolName: "searchNotes", label: "Searched this turn", status: "complete" }],
    sources: [{ noteId: "current-note", title: "Current turn source" }],
    proposals: [],
};

const dispatch = {
    addAiChatTab: vi.fn(),
    selectNoteById: vi.fn(),
    syncNoteFromRepository: vi.fn(),
};

function renderChatPage(): void {
    vi.mocked(useGlobalStore).mockReturnValue([
        { notes: [], theme: "dark", directory: null, note: null },
        dispatch,
    ] as never);
    render(
        <MemoryRouter initialEntries={["/chat"]}>
            <ChatPage />
        </MemoryRouter>,
    );
}

describe("ChatPage workspace tool sessions", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalScrollToDescriptor) {
            Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollToDescriptor);
        } else {
            Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("matchMedia", () => ({ matches: false }));
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true,
            value: vi.fn(),
        });
        mocks.setWorkspaceData(PRIOR_TURN_DATA);
        mocks.turnSnapshots.length = 0;
        mocks.send.mockImplementation(async (...args) => {
            const getWorkspaceData = args[5] as (() => AIWorkspaceData) | undefined;
            if (getWorkspaceData) mocks.turnSnapshots.push(structuredClone(getWorkspaceData()));
            if (mocks.turnSnapshots.length === 1) mocks.setWorkspaceData(CURRENT_TURN_DATA);
            return true;
        });
    });

    it("starts each of two prompts with no activities, sources, or proposals from the prior turn", async () => {
        const user = userEvent.setup();
        renderChatPage();

        await user.click(
            screen.getByRole("button", { name: "Summarize this workspace and call out the most active topics." }),
        );
        await waitFor(() => expect(mocks.turnSnapshots).toHaveLength(1));
        expect(mocks.turnSnapshots[0]).toStrictEqual(EMPTY_WORKSPACE_DATA);

        await user.click(
            screen.getByRole("button", { name: "Find notes that mention open decisions and group them by project." }),
        );
        await waitFor(() => expect(mocks.turnSnapshots).toHaveLength(2));

        expect(mocks.turnSnapshots).toStrictEqual([EMPTY_WORKSPACE_DATA, EMPTY_WORKSPACE_DATA]);
    });
});
