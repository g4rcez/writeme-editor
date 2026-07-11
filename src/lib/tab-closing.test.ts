import { describe, expect, it } from "vitest";
import { getPreviousTabAfterClose } from "./tab-closing";

const tabs = [
    { id: "tab-1", noteId: "note-1" },
    { id: "tab-2", noteId: "note-2" },
    { id: "tab-3", noteId: "note-3" },
];

describe("getPreviousTabAfterClose", () => {
    it("returns the tab immediately before the closed tab", () => {
        expect(getPreviousTabAfterClose(tabs, "tab-3")?.noteId).toBe("note-2");
        expect(getPreviousTabAfterClose(tabs, "tab-2")?.noteId).toBe("note-1");
    });

    it("falls back to the next tab when closing the first tab", () => {
        expect(getPreviousTabAfterClose(tabs, "tab-1")?.noteId).toBe("note-2");
    });

    it("returns null when closing the only tab", () => {
        expect(getPreviousTabAfterClose([tabs[0]!], "tab-1")).toBeNull();
    });

    it("returns null when the closing tab is missing", () => {
        expect(getPreviousTabAfterClose(tabs, "missing")).toBeNull();
    });
});
