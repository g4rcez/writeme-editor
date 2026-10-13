import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tab } from "@/store/repositories/entities/tab";
import { clearRecentlyClosedTabs, rememberClosedTab, takeRecentlyClosedTab } from "@/lib/recently-closed-tabs";
import { shortcuts } from "@/lib/shortcuts";
import { AI_CHAT_TAB_TYPE, TERMINAL_TAB_TYPE } from "@/lib/tab-target";
import { useGlobalStore } from "../../store/global.store";
import { mapShortcutOS, useShortcuts, useWritemeShortcuts, Type } from "./shortcut-items";
const mocks = vi.hoisted(() => ({
    openFileOrDirectory: vi.fn(),
    migrateNotes: vi.fn(),
}));

vi.mock("../../store/global.store", () => ({
    CommanderType: {
        All: "all",
        Notes: "Notes",
        OpenTabs: "OpenTabs",
    },
    useGlobalStore: vi.fn(),
    globalDispatch: {
        theme: vi.fn(),
    },
}));

vi.mock("../../lib/is-electron", () => ({
    isElectron: vi.fn(() => true),
}));
vi.mock("@/app/lib/open-directory-as-workspace", () => ({
    migrateWebOnlyNotesToDirectory: mocks.migrateNotes,
}));

describe("shortcut-items", () => {
    const dispatch = {
        commander: vi.fn(),
        directoryBrowserDialog: vi.fn(),
        recentNotesDialog: vi.fn(),
        setAiDrawer: vi.fn(),
        switchWorkspace: vi.fn(),
        theme: vi.fn(),
        addAiChatTab: vi.fn(),
        addTerminalTab: vi.fn(),
        selectNoteById: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        clearRecentlyClosedTabs();
        mocks.openFileOrDirectory.mockResolvedValue({ path: "/workspace", isDirectory: true });
        mocks.migrateNotes.mockResolvedValue(undefined);
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: { fs: { openFileOrDirectory: mocks.openFileOrDirectory } },
        });
        (useGlobalStore as any).mockReturnValue([{ theme: "dark" }, dispatch]);
    });

    it("formats Electron CommandOrControl accelerators for display", () => {
        const label = mapShortcutOS("CommandOrControl+Alt+N");

        expect(label).toMatch(/^(⌘|Ctrl) \+ Alt \+ N$/);
        expect(label).not.toContain("CommandOrControl");
    });

    it("should not include an Open Recent keyboard shortcut", () => {
        const { result } = renderHook(() => useWritemeShortcuts(), {
            wrapper: MemoryRouter,
        });

        expect(result.current.find((s) => s.description === "Open Recent")).toBeUndefined();
        expect(result.current.find((s) => s.bind === "mod+e")).toBeUndefined();
    });

    it("should have all required shortcuts", () => {
        const { result } = renderHook(() => useWritemeShortcuts(), {
            wrapper: MemoryRouter,
        });
        const descriptions = result.current.map((s) => s.description);

        expect(descriptions).toContain("Commander");
        expect(descriptions).toContain("Open Tabs");
        expect(descriptions).toContain("Restore Closed Tab");
        expect(descriptions).toContain("Settings");
        expect(descriptions).toContain("Browse files");
        expect(descriptions).toContain("Open...");
    });

    it("includes the Commander shortcut binding", () => {
        const { result } = renderHook(() => useWritemeShortcuts(), {
            wrapper: MemoryRouter,
        });
        const commander = result.current.find((s) => s.description === "Commander");

        expect(commander).toBeDefined();
        expect(commander?.bind).toBe("mod+shift+p");
        expect(commander?.type).toBe(Type.Shortcut);
    });

    it.each([
        { type: "tab", noteId: "note-1", expectedPath: "/note/note-1", method: "selectNoteById" },
        {
            type: AI_CHAT_TAB_TYPE,
            noteId: "chat-1",
            expectedPath: "/chat?chatId=chat-1",
            method: "addAiChatTab",
        },
        {
            type: TERMINAL_TAB_TYPE,
            noteId: "terminal-1",
            expectedPath: "/terminal/terminal-1",
            method: "addTerminalTab",
        },
    ])("restores a closed $type tab", async ({ type, noteId, expectedPath, method }) => {
        const tab: Tab = {
            id: `${type}-tab`,
            noteId,
            order: 0,
            project: "workspace",
            type,
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            updatedAt: new Date("2024-01-01T00:00:00.000Z"),
            scrollY: 0,
        };
        rememberClosedTab(tab);
        const { result } = renderHook(() => ({ shortcuts: useWritemeShortcuts(), location: useLocation() }), {
            wrapper: MemoryRouter,
        });
        const restore = result.current.shortcuts.find((shortcut) => shortcut.description === "Restore Closed Tab");

        expect(restore?.bind).toBe("mod+shift+t");
        await act(async () => restore?.action());

        if (method === "selectNoteById") expect(dispatch.selectNoteById).toHaveBeenCalledWith(noteId);
        else if (method === "addAiChatTab") expect(dispatch.addAiChatTab).toHaveBeenCalledWith(noteId);
        else expect(dispatch.addTerminalTab).toHaveBeenCalledWith(noteId);
        expect(result.current.location.pathname + result.current.location.search).toBe(expectedPath);
        expect(takeRecentlyClosedTab()).toBeNull();
    });

    it("restores the latest tab when the registered Cmd/Ctrl+Shift+T shortcut fires", async () => {
        rememberClosedTab({
            id: "tab-1",
            noteId: "note-1",
            order: 0,
            project: "workspace",
            type: "tab",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            updatedAt: new Date("2024-01-01T00:00:00.000Z"),
            scrollY: 0,
        });
        const { unmount } = renderHook(() => useShortcuts(), { wrapper: MemoryRouter });
        const event = new KeyboardEvent("keydown", {
            key: "T",
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });

        await act(async () => {
            window.dispatchEvent(event);
        });

        expect(event.defaultPrevented).toBe(true);
        expect(dispatch.selectNoteById).toHaveBeenCalledWith("note-1");
        expect(takeRecentlyClosedTab()).toBeNull();
        unmount();
        expect(shortcuts.list()).toHaveLength(0);
    });

    it("does nothing when there are no recently closed tabs", async () => {
        const { result } = renderHook(() => useWritemeShortcuts(), { wrapper: MemoryRouter });
        const restore = result.current.find((shortcut) => shortcut.description === "Restore Closed Tab");

        await act(async () => restore?.action());

        expect(dispatch.selectNoteById).not.toHaveBeenCalled();
        expect(dispatch.addAiChatTab).not.toHaveBeenCalled();
        expect(dispatch.addTerminalTab).not.toHaveBeenCalled();
    });

    it("includes the Settings shortcut binding", () => {
        const { result } = renderHook(() => useWritemeShortcuts(), {
            wrapper: MemoryRouter,
        });
        const settings = result.current.find((s) => s.description === "Settings");

        expect(settings).toBeDefined();
        expect(settings?.bind).toBe("mod+,");
        expect(settings?.type).toBe(Type.Shortcut);
    });

    it("opens the commander in opened-tabs mode from the Open Tabs shortcut", () => {
        const { result } = renderHook(() => useWritemeShortcuts(), {
            wrapper: MemoryRouter,
        });
        const openTabs = result.current.find((s) => s.description === "Open Tabs");

        expect(openTabs).toBeDefined();
        expect(openTabs?.bind).toBe("mod+t");

        openTabs?.action();

        expect(dispatch.commander).toHaveBeenCalledWith(true, "OpenTabs");
    });

    it("migrates local-only notes before switching workspaces from Open...", async () => {
        let finishMigration!: () => void;
        const migration = new Promise<void>((resolve) => {
            finishMigration = resolve;
        });
        mocks.migrateNotes.mockReturnValue(migration);

        const { result } = renderHook(() => useWritemeShortcuts(), {
            wrapper: MemoryRouter,
        });
        const openFolder = result.current.find((shortcut) => shortcut.description === "Open...");
        if (!openFolder) throw new Error("Open... shortcut not found");
        const opening = openFolder.action();

        await waitFor(() => expect(mocks.migrateNotes).toHaveBeenCalledWith("/workspace"));
        expect(dispatch.switchWorkspace).not.toHaveBeenCalled();

        finishMigration();
        await opening;
        expect(dispatch.switchWorkspace).toHaveBeenCalledWith("/workspace");
    });
});
