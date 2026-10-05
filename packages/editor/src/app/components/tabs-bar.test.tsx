import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tab } from "@/store/repositories/entities/tab";
import type { TerminalSession } from "@/store/repositories/entities/terminal-session";
import { clearSuppressedNoteRouteTabOpens, isNoteRouteTabOpenSuppressed } from "@/lib/note-route-tab-open-suppression";
import { TERMINAL_TAB_TYPE } from "@/lib/tab-target";
import { uiDispatch } from "@/store/ui.store";
import { TabsBar } from "./tabs-bar";

vi.mock("@/store/ui.store", () => ({
    uiDispatch: {
        clearConfirm: vi.fn(),
        setConfirm: vi.fn(),
    },
}));

const createTab = (overrides: Partial<Tab> & Pick<Tab, "id" | "noteId">): Tab => ({
    type: "tab",
    order: 0,
    project: "workspace-a",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    scrollY: 0,
    ...overrides,
});

const createTerminalSession = (
    overrides: Partial<TerminalSession> & Pick<TerminalSession, "id" | "title">,
): TerminalSession => ({
    type: "terminal-session",
    project: "workspace-a",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
});

function createDispatch() {
    return {
        activeTabId: vi.fn(),
        addAiChatTab: vi.fn(),
        addTerminalTab: vi.fn(),
        note: vi.fn(),
        removeTab: vi.fn().mockResolvedValue(undefined),
        renameTerminalSession: vi.fn().mockResolvedValue(undefined),
        selectNoteById: vi.fn(),
        setNote: vi.fn(),
    };
}

type ConfirmState = {
    title: string;
    message: string;
    onConfirm: () => void;
};

function renderTabsBar({
    tabs,
    terminalSessions,
    activeTabId = null,
    initialRoute = "/",
    dispatch = createDispatch(),
}: {
    tabs: Tab[];
    terminalSessions: TerminalSession[];
    activeTabId?: string | null;
    initialRoute?: string;
    dispatch?: ReturnType<typeof createDispatch>;
}) {
    render(
        <MemoryRouter initialEntries={[initialRoute]}>
            <TabsBar
                tabs={tabs}
                notes={[]}
                directory="workspace-a"
                activeTabId={activeTabId}
                terminalSessions={terminalSessions}
                dispatch={dispatch as never}
            />
        </MemoryRouter>,
    );
    return dispatch;
}

describe("TabsBar terminal tabs", () => {
    beforeEach(() => {
        clearSuppressedNoteRouteTabOpens();
        vi.clearAllMocks();
    });

    it("renders terminal session titles and routes to terminal session pages", () => {
        renderTabsBar({
            tabs: [
                createTab({
                    id: "terminal-tab",
                    noteId: "terminal-1",
                    type: TERMINAL_TAB_TYPE,
                }),
            ],
            terminalSessions: [createTerminalSession({ id: "terminal-1", title: "Build logs" })],
        });

        const terminalLink = screen.getByRole("link", { name: /build logs/i });
        expect(terminalLink).toHaveAttribute("href", "/terminal/terminal-1");
    });

    it("renames terminal tabs through the tab bar", async () => {
        const user = userEvent.setup();
        const dispatch = renderTabsBar({
            tabs: [
                createTab({
                    id: "terminal-tab",
                    noteId: "terminal-1",
                    type: TERMINAL_TAB_TYPE,
                }),
            ],
            terminalSessions: [createTerminalSession({ id: "terminal-1", title: "Build logs" })],
        });

        fireEvent.doubleClick(screen.getByText("Build logs"));
        const input = screen.getByDisplayValue("Build logs");
        await user.clear(input);
        await user.type(input, "Release shell{enter}");

        await waitFor(() => {
            expect(dispatch.renameTerminalSession).toHaveBeenCalledWith("terminal-1", "Release shell");
        });
    });

    it("asks for terminal close confirmation with the terminal name before killing the session", () => {
        const dispatch = renderTabsBar({
            initialRoute: "/note/note-1",
            activeTabId: "note-tab",
            tabs: [
                createTab({ id: "note-tab", noteId: "note-1", order: 0 }),
                createTab({
                    id: "terminal-tab",
                    noteId: "terminal-1",
                    order: 1,
                    type: TERMINAL_TAB_TYPE,
                }),
            ],
            terminalSessions: [createTerminalSession({ id: "terminal-1", title: "Build logs" })],
        });

        fireEvent.click(screen.getByRole("button", { name: "Close Build logs" }));

        expect(uiDispatch.setConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Close Build logs?",
                message: 'Closing terminal "Build logs" will kill its running shell session.',
                confirmText: "Close Terminal",
            }),
        );
        expect(dispatch.removeTab).not.toHaveBeenCalled();

        const confirm = vi.mocked(uiDispatch.setConfirm).mock.calls[0]?.[0] as ConfirmState;
        confirm.onConfirm();

        expect(uiDispatch.clearConfirm).toHaveBeenCalled();
        expect(dispatch.removeTab).toHaveBeenCalledWith("terminal-tab");
    });

    it("clears the active tab and suppresses route reopening before removing the last active tab", async () => {
        const dispatch = renderTabsBar({
            initialRoute: "/note/note-1",
            activeTabId: "note-tab",
            tabs: [createTab({ id: "note-tab", noteId: "note-1", order: 0 })],
            terminalSessions: [],
        });

        fireEvent.click(screen.getByRole("button", { name: "Close Untitled" }));

        await waitFor(() => {
            expect(dispatch.removeTab).toHaveBeenCalledWith("note-tab");
        });
        expect(dispatch.activeTabId).toHaveBeenCalledWith(null);
        expect(dispatch.setNote).not.toHaveBeenCalled();
        expect(isNoteRouteTabOpenSuppressed("note-1")).toBe(true);
    });
});
