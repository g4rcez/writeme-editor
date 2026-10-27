import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uiDispatch, useUIStore } from "./ui.store";

const storageKey = "WRITEME_UI_SETTINGS";

describe("UI store update isolation", () => {
    beforeEach(() => {
        uiDispatch.setContentWidth("medium");
        uiDispatch.setFocusMode(false);
        uiDispatch.setSidebarOpen(true);
        uiDispatch.clearError();
        uiDispatch.setParsingContent(false);
        uiDispatch.setEditorSaveStatus("saved");
    });

    afterEach(() => vi.restoreAllMocks());

    it("does not persist transient editor or dialog updates", () => {
        const write = vi.spyOn(Storage.prototype, "setItem");
        uiDispatch.setEditorSaveStatus("unsaved", "transient-note");
        uiDispatch.setParsingContent(true);
        uiDispatch.setError("Save failed");
        uiDispatch.openFindReplace();
        uiDispatch.closeFindReplace();
        expect(write).not.toHaveBeenCalled();
    });

    it("persists changed preferences once, without transient state", () => {
        const write = vi.spyOn(Storage.prototype, "setItem");
        uiDispatch.setContentWidth("wide");
        uiDispatch.setContentWidth("wide");
        uiDispatch.setEditorSaveStatus("saving", "persist-note");
        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith(storageKey, JSON.stringify({
            contentWidth: "wide",
            focusMode: false,
            sidebarOpen: true,
        }));
        uiDispatch.setFocusMode(true);
        uiDispatch.setSidebarOpen(false);
        expect(JSON.parse(localStorage.getItem(storageKey) ?? "{}")).toEqual({
            contentWidth: "wide",
            focusMode: true,
            sidebarOpen: false,
        });
    });

    it("keeps the state and status map unchanged for repeated save statuses", () => {
        uiDispatch.setEditorSaveStatus("unsaved", "repeated-note");
        const previous = useUIStore.getState();
        uiDispatch.setEditorSaveStatus("unsaved", "repeated-note");
        expect(useUIStore.getState()).toBe(previous);
    });

    it("keeps the per-note map stable when only the aggregate status changes", () => {
        uiDispatch.setEditorSaveStatus("saved", "first-note");
        uiDispatch.setEditorSaveStatus("unsaved", "second-note");
        const statuses = useUIStore.getState().noteSaveStatuses;
        uiDispatch.setEditorSaveStatus("saved", "first-note");
        expect(useUIStore.getState().editorSaveStatus).toBe("saved");
        expect(useUIStore.getState().noteSaveStatuses).toBe(statuses);
        expect(statuses["second-note"]).toBe("unsaved");
    });

    it("does not rerender a sidebar selector for save-status or parsing updates", () => {
        const selectedRender = vi.fn();
        const broadRender = vi.fn();
        function SelectedSidebar() {
            const [state] = useUIStore((state) => ({ sidebarOpen: state.sidebarOpen }));
            selectedRender();
            return <span>{String(state.sidebarOpen)}</span>;
        }
        function BroadSubscriber() {
            useUIStore();
            broadRender();
            return null;
        }
        render(<><SelectedSidebar /><BroadSubscriber /></>);
        selectedRender.mockClear();
        broadRender.mockClear();
        act(() => uiDispatch.setEditorSaveStatus("unsaved", "render-note"));
        act(() => uiDispatch.setParsingContent(true));
        expect(broadRender).toHaveBeenCalledTimes(2);
        expect(selectedRender).not.toHaveBeenCalled();
        act(() => uiDispatch.setSidebarOpen(false));
        expect(selectedRender).toHaveBeenCalledTimes(1);
    });
});
