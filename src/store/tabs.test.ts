import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWorkspaceKey,
  normalizeWorkspaceTabs,
  useGlobalStore,
} from "./global.store";
import { AI_CHAT_TAB_TYPE } from "@/lib/tab-target";

import type { Tab } from "./repositories/entities/tab";

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
  },
}));

// Mock window and document
Object.defineProperty(window, "scrollTo", { value: vi.fn() });
Object.defineProperty(document.documentElement, "classList", {
  value: { add: vi.fn(), remove: vi.fn() },
});

const createTab = (
  id: string,
  noteId: string,
  order: number,
  project = "workspace-a",
  type = "tab",
): Tab => ({
  id,
  noteId,
  order,
  project,
  type,
  createdAt: new Date(`2024-01-01T00:00:0${order}.000Z`),
  updatedAt: new Date(`2024-01-01T00:00:0${order}.000Z`),
  scrollY: 0,
});

describe("Tab Management Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGlobalStore.dispatchers.init(
      "light" as any,
      [],
      [],
      16,
      256,
      null,
      null,
    );
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

    const result = normalizeWorkspaceTabs(
      [legacyTab, workspaceTab, otherTab],
      workspace,
    );

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

    const result = normalizeWorkspaceTabs(
      [secondTab, duplicateTab, firstTab],
      workspace,
    );

    expect(
      result.tabs.map((tab) => ({ id: tab.id, order: tab.order })),
    ).toStrictEqual([
      { id: "first-tab", order: 0 },
      { id: "second-tab", order: 1 },
    ]);
    expect(result.duplicateTabs).toStrictEqual([duplicateTab]);
  });

  it("keeps note and AI chat tabs with the same target id separate", () => {
    const workspace = "workspace-a";
    const noteTab = createTab("note-tab", "shared-id", 0, workspace);
    const chatTab = createTab(
      "chat-tab",
      "shared-id",
      1,
      workspace,
      AI_CHAT_TAB_TYPE,
    );

    const result = normalizeWorkspaceTabs([noteTab, chatTab], workspace);

    expect(result.tabs).toStrictEqual([noteTab, chatTab]);
    expect(result.duplicateTabs).toStrictEqual([]);
  });

  it("deduplicates AI chat tabs independently from note tabs", () => {
    const workspace = "workspace-a";
    const firstChatTab = createTab(
      "chat-tab-1",
      "chat-1",
      0,
      workspace,
      AI_CHAT_TAB_TYPE,
    );
    const duplicateChatTab = createTab(
      "chat-tab-2",
      "chat-1",
      1,
      workspace,
      AI_CHAT_TAB_TYPE,
    );

    const result = normalizeWorkspaceTabs(
      [duplicateChatTab, firstChatTab],
      workspace,
    );

    expect(result.tabs).toStrictEqual([firstChatTab]);
    expect(result.duplicateTabs).toStrictEqual([duplicateChatTab]);
  });

  it("does not collapse tabs for different workspaces when normalized separately", () => {
    const workspaceATab = createTab(
      "workspace-a-tab",
      "note-1",
      0,
      "workspace-a",
    );
    const workspaceBTab = createTab(
      "workspace-b-tab",
      "note-1",
      0,
      "workspace-b",
    );

    const result = normalizeWorkspaceTabs([workspaceATab], "workspace-a");

    expect(result.tabs).toStrictEqual([workspaceATab]);
    expect(result.duplicateTabs).toStrictEqual([]);
    expect(workspaceBTab.project).toBe("workspace-b");
  });
});
