import { act, render, screen } from "@testing-library/react";
import { Profiler, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalDispatchers } from "@/store/global.store";
import type { Tab } from "@/store/repositories/entities/tab";
import { Note } from "@/store/note";
import { uiDispatch } from "@/store/ui.store";
import { TabsBar } from "./tabs-bar";
import { NoteSaveStatus } from "./note-save-status";

const { renderTab } = vi.hoisted(() => ({ renderTab: vi.fn() }));

vi.mock("./motion-editor-tab", () => ({
    MotionEditorTab: ({ title, children }: { title: string; children: ReactNode }) => {
        renderTab(title);
        return <div>{children}</div>;
    },
}));

function setup() {
    const notes = [Note.new("First note", "First"), Note.new("Second note", "Second")];
    const tabs: Tab[] = notes.map((note, order) => ({
        id: `tab-${order}`,
        noteId: note.id,
        type: "tab",
        order,
        project: "__local__",
        createdAt: new Date(),
        updatedAt: new Date(),
        scrollY: 0,
    }));
    const dispatch = {
        setCreateNoteDialog: vi.fn(),
        removeTab: vi.fn(),
        activeTabId: vi.fn(),
    } as unknown as GlobalDispatchers;
    render(
        <MemoryRouter>
            <TabsBar tabs={tabs} notes={notes} directory={null} activeTabId={null}
                terminalSessions={[]} dispatch={dispatch} />
        </MemoryRouter>,
    );
    renderTab.mockClear();
    return notes;
}

describe("tab save-status subscriptions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rerenders only the tab whose status changes", () => {
        const [first] = setup();
        if (!first) throw new Error("Missing first tab fixture.");
        act(() => uiDispatch.setEditorSaveStatus("unsaved", first.id));
        expect(renderTab.mock.calls.map(([title]) => title)).toEqual(["First note"]);
        expect(screen.getByRole("button", { name: "Close First note (unsaved changes)" })).toBeVisible();
        expect(screen.getByRole("link", { name: /First note/ })).toHaveAttribute("data-save-status", "unsaved");
        renderTab.mockClear();
        act(() => uiDispatch.setEditorSaveStatus("unsaved", first.id));
        expect(renderTab).not.toHaveBeenCalled();
        act(() => uiDispatch.setEditorSaveStatus("saved", first.id));
        expect(screen.getByRole("button", { name: "Close First note" })).toBeVisible();
    });

    it("updates the note status indicator only for its own note", () => {
        const committed = vi.fn();
        render(
            <Profiler id="note-status" onRender={committed}>
                <NoteSaveStatus noteId="indicator-note" />
            </Profiler>,
        );
        committed.mockClear();
        act(() => uiDispatch.setEditorSaveStatus("error", "other-indicator-note"));
        expect(committed).not.toHaveBeenCalled();
        act(() => uiDispatch.setEditorSaveStatus("saving", "indicator-note"));
        expect(committed).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText("Note save status")).toHaveTextContent("Saving…");
    });

    it("does not rerender tabs for unrelated UI or unopened-note updates", () => {
        setup();
        act(() => uiDispatch.setError("An unrelated error"));
        act(() => uiDispatch.setParsingContent(true));
        act(() => uiDispatch.setEditorSaveStatus("saving", "unopened-note"));
        expect(renderTab).not.toHaveBeenCalled();
    });
});
