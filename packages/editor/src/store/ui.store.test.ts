import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore, uiDispatch } from "./ui.store";

describe("uiStore — parsingContent", () => {
    beforeEach(() => {
        localStorage.clear();
        uiDispatch.setParsingContent(false);
    });

    it("defaults to false", () => {
        const state = useUIStore.getState();
        expect(state.parsingContent).toBe(false);
    });

    it("setParsingContent(true) sets it to true", () => {
        uiDispatch.setParsingContent(true);
        const state = useUIStore.getState();
        expect(state.parsingContent).toBe(true);
    });

    it("setParsingContent(false) clears it", () => {
        uiDispatch.setParsingContent(true);
        uiDispatch.setParsingContent(false);
        const state = useUIStore.getState();
        expect(state.parsingContent).toBe(false);
    });

    it("does not persist parsingContent to localStorage", () => {
        uiDispatch.setParsingContent(true);
        expect(localStorage.getItem("WRITEME_UI_SETTINGS")).toBeNull();

        const width = useUIStore.getState().contentWidth === "wide" ? "medium" : "wide";
        uiDispatch.setContentWidth(width);
        const raw = localStorage.getItem("WRITEME_UI_SETTINGS");
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw ?? "{}")).toEqual({
            contentWidth: width,
            focusMode: useUIStore.getState().focusMode,
            sidebarOpen: useUIStore.getState().sidebarOpen,
        });

        uiDispatch.setParsingContent(false);
        expect(localStorage.getItem("WRITEME_UI_SETTINGS")).toBe(raw);
    });
});
