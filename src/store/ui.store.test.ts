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
        localStorage.clear();
        uiDispatch.setParsingContent(true);
        const raw = localStorage.getItem("WRITEME_UI_SETTINGS");
        expect(raw).not.toBeNull();
        const persisted = JSON.parse(raw!);
        expect(persisted).not.toHaveProperty("parsingContent");
        expect(persisted).toHaveProperty("contentWidth");
    });
});
