import { describe, it, expect, vi, beforeEach } from "vitest";
import { AI_CHAT_TAB_TYPE, TERMINAL_TAB_TYPE } from "@/lib/tab-target";
import type { Tab } from "./repositories/entities/tab";
import type { TerminalSession } from "./repositories/entities/terminal-session";
import { getWorkspaceKey, normalizeWorkspaceTabs, useGlobalStore } from "./global.store";
import { repositories } from "./repositories";

// Mock repositories
vi.mock("./repositories", () => ({
    repositories: {
        tabs: {
            save: vi.fn(),
            delete: vi.fn(),
            updateOrder: vi.fn(),
            deleteByNoteId: vi.fn(),
        },
        notes: {
            update: vi.fn(),
            getOne: vi.fn(),
        },
        terminalSessions: {
            getOne: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

// Mock window and document
Object.defineProperty(window, "scrollTo", { value: vi.fn() });
Object.defineProperty(document.documentElement, "classList", {
    value: { add: vi.fn(), remove: vi.fn() },
});

const createTab = (id: string, noteId: string, order: number, project = "workspace-a", type = "tab"): Tab => ({
    id,
    noteId,
    order,
    project,
    type,
    createdAt: new Date(`2024-01-01T00:00:0${order}.000Z`),
    updatedAt: new Date(`2024-01-01T00:00:0${order}.000Z`),
    scrollY: 0,
});

const createTerminalSession = (id: string, title: string, project = "workspace-a"): TerminalSession => ({
    id,
    title,
    project,
    type: "terminal-session",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
});

describe("Tab Management Logic", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(repositories.terminalSessions.getOne).mockResolvedValue(null);
        await useGlobalStore.dispatchers.init("light" as any, [], [], 16, 256, null, null, []);
    });

    it("should keep local-storage tabs in a stable local workspace bucket", () => {
        expect(getWorkspaceKey(null)).toBe("__local__");
        expect(getWorkspaceKey("")).toBe("__local__");
    });

    it("should use the workspace directory as the tab isolation key", () => {
        const workspace = "/Users/allangarcez/Documents/g4rcez/writeme-editor";

        expect(getWorkspaceKey(workspace)).toBe(workspace);
    });

    it("deduplicates persisted tabs by note within the current workspace", () => {
        const workspace = "workspace-a";
        const legacyTab = createTab("legacy-tab", "note-1", 0, "");
        const workspaceTab = createTab("workspace-tab", "note-1", 1, workspace);
        const otherTab = createTab("other-tab", "note-2", 2, workspace);

        const result = normalizeWorkspaceTabs([legacyTab, workspaceTab, otherTab], workspace);

        expect(result.tabs).toStrictEqual([
            { ...workspaceTab, order: 0 },
            { ...otherTab, order: 1 },
        ]);
        expect(result.duplicateTabs).toStrictEqual([legacyTab]);
    });

    it("normalizes tab order after duplicate tabs are removed", () => {
        const workspace = "workspace-a";
        const firstTab = createTab("first-tab", "note-1", 4, workspace);
        const duplicateTab = createTab("duplicate-tab", "note-1", 8, workspace);
        const secondTab = createTab("second-tab", "note-2", 12, workspace);

        const result = normalizeWorkspaceTabs([secondTab, duplicateTab, firstTab], workspace);

        expect(result.tabs.map((tab) => ({ id: tab.id, order: tab.order }))).toStrictEqual([
            { id: "first-tab", order: 0 },
            { id: "second-tab", order: 1 },
        ]);
        expect(result.duplicateTabs).toStrictEqual([duplicateTab]);
    });

    it("keeps note and AI chat tabs with the same target id separate", () => {
        const workspace = "workspace-a";
        const noteTab = createTab("note-tab", "shared-id", 0, workspace);
        const chatTab = createTab("chat-tab", "shared-id", 1, workspace, AI_CHAT_TAB_TYPE);

        const result = normalizeWorkspaceTabs([noteTab, chatTab], workspace);

        expect(result.tabs).toStrictEqual([noteTab, chatTab]);
        expect(result.duplicateTabs).toStrictEqual([]);
    });

    it("deduplicates AI chat tabs independently from note tabs", () => {
        const workspace = "workspace-a";
        const firstChatTab = createTab("chat-tab-1", "chat-1", 0, workspace, AI_CHAT_TAB_TYPE);
        const duplicateChatTab = createTab("chat-tab-2", "chat-1", 1, workspace, AI_CHAT_TAB_TYPE);

        const result = normalizeWorkspaceTabs([duplicateChatTab, firstChatTab], workspace);

        expect(result.tabs).toStrictEqual([firstChatTab]);
        expect(result.duplicateTabs).toStrictEqual([duplicateChatTab]);
    });

    it("does not collapse tabs for different workspaces when normalized separately", () => {
        const workspaceATab = createTab("workspace-a-tab", "note-1", 0, "workspace-a");
        const workspaceBTab = createTab("workspace-b-tab", "note-1", 0, "workspace-b");

        const result = normalizeWorkspaceTabs([workspaceATab], "workspace-a");

        expect(result.tabs).toStrictEqual([workspaceATab]);
        expect(result.duplicateTabs).toStrictEqual([]);
        expect(workspaceBTab.project).toBe("workspace-b");
    });

    it("keeps note, AI chat, and terminal tabs with the same target id separate", () => {
        const workspace = "workspace-a";
        const noteTab = createTab("note-tab", "shared-id", 0, workspace);
        const chatTab = createTab("chat-tab", "shared-id", 1, workspace, AI_CHAT_TAB_TYPE);
        const terminalTab = createTab("terminal-tab", "shared-id", 2, workspace, TERMINAL_TAB_TYPE);

        const result = normalizeWorkspaceTabs([noteTab, chatTab, terminalTab], workspace);

        expect(result.tabs).toStrictEqual([noteTab, chatTab, terminalTab]);
        expect(result.duplicateTabs).toStrictEqual([]);
    });

    it("creates terminal tab metadata and selects the new tab", async () => {
        await useGlobalStore.dispatchers.init("light" as any, [], [], 16, 256, "workspace-a", "workspace-a", []);

        await useGlobalStore.dispatchers.addTerminalTab("terminal-1");

        const state = useGlobalStore.getState();
        expect(state.tabs[0]).toMatchObject({
            noteId: "terminal-1",
            project: "workspace-a",
            type: TERMINAL_TAB_TYPE,
        });
        expect(state.activeTabId).toBe(state.tabs[0]?.id);
        expect(state.terminalSessions).toMatchObject([{ id: "terminal-1", title: "Terminal", project: "workspace-a" }]);
        expect(repositories.terminalSessions.save).toHaveBeenCalledWith(
            expect.objectContaining({ id: "terminal-1", title: "Terminal" }),
        );
    });

    it("renames terminal session metadata", async () => {
        const session = createTerminalSession("terminal-1", "Terminal");
        await useGlobalStore.dispatchers.init("light" as any, [], [], 16, 256, "workspace-a", "workspace-a", [session]);

        await useGlobalStore.dispatchers.renameTerminalSession("terminal-1", "Build logs");

        expect(useGlobalStore.getState().terminalSessions[0]).toMatchObject({
            id: "terminal-1",
            title: "Build logs",
        });
        expect(repositories.terminalSessions.save).toHaveBeenCalledWith(
            expect.objectContaining({ id: "terminal-1", title: "Build logs" }),
        );
    });

    it("removes terminal metadata when closing a terminal tab", async () => {
        const tab = createTab("terminal-tab", "terminal-1", 0, "workspace-a", TERMINAL_TAB_TYPE);
        const session = createTerminalSession("terminal-1", "Terminal");
        await useGlobalStore.dispatchers.init("light" as any, [], [tab], 16, 256, "workspace-a", "workspace-a", [
            session,
        ]);

        await useGlobalStore.dispatchers.removeTab("terminal-tab");

        expect(useGlobalStore.getState().tabs).toStrictEqual([]);
        expect(useGlobalStore.getState().terminalSessions).toStrictEqual([]);
        expect(repositories.terminalSessions.delete).toHaveBeenCalledWith("terminal-1");
    });
});
