import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@/store/note";
import { NoteHistoryDialog, formatSnapshotDate } from "./note-history-dialog";

const mocks = vi.hoisted(() => ({
    getHistory: vi.fn(),
    restoreSnapshot: vi.fn(),
    getContent: vi.fn(),
}));

vi.mock("@/store/repositories", () => ({
    repositories: { notes: { getHistory: mocks.getHistory, restoreSnapshot: mocks.restoreSnapshot } },
}));
vi.mock("@/app/editor-global-ref", () => ({
    editorSearchGlobalRef: { current: { getContent: mocks.getContent } },
}));
vi.mock("@/app/notification-ref", () => ({ notificationRef: { current: null } }));
function setDesktopViewport(): void {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

const snapshot = {
    id: "snapshot-1",
    noteId: "note-1",
    content: "body",
    createdAt: new Date(2026, 0, 2, 15, 4),
} as const;

describe("note history UI", () => {
    beforeEach(() => {
        setDesktopViewport();
        vi.clearAllMocks();
        mocks.getHistory.mockResolvedValue([snapshot]);
        mocks.getContent.mockReturnValue("Current live content");
    });

    afterEach(() => {
        cleanup();
        Reflect.deleteProperty(window, "matchMedia");
    });

    it("formats snapshot dates with the shared date helpers", () => {
        expect(formatSnapshotDate(snapshot)).toBe("2026-01-02 15:04");
    });

    it("shows live content beside the saved version and keeps it on restore failure", async () => {
        const user = userEvent.setup();
        const onRestored = vi.fn();
        mocks.restoreSnapshot.mockRejectedValue(new Error("Storage unavailable"));

        render(
            <NoteHistoryDialog
                note={{ id: "note-1", content: "Last saved content" } as Note}
                open
                onClose={vi.fn()}
                onRestored={onRestored}
            />,
        );

        const currentNote = await screen.findByRole("region", { name: "Current note" });
        expect(currentNote).toHaveTextContent("Current live content");
        const currentPreview = currentNote.querySelector("pre");
        expect(currentPreview).not.toBeNull();
        expect(currentPreview).not.toHaveAttribute("contenteditable");
        expect(screen.getByRole("region", { name: "Saved version preview" })).toHaveTextContent("body");

        const historyDialog = screen.getByRole("dialog", { name: "Note history" });
        await user.click(within(historyDialog).getByRole("button", { name: "Restore" }));
        const confirmation = within(historyDialog).getByRole("group", { name: "Restore confirmation" });
        expect(confirmation).toHaveTextContent("Your current content will be preserved in local history.");
        await user.click(within(confirmation).getByRole("button", { name: "Restore" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Storage unavailable");
        expect(currentNote).toHaveTextContent("Current live content");
        expect(onRestored).not.toHaveBeenCalled();
        expect(mocks.restoreSnapshot).toHaveBeenCalledWith("note-1", "snapshot-1");
    });
});
