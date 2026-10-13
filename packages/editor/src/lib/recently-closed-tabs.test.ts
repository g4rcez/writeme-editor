import { describe, expect, it, beforeEach } from "vitest";
import type { Tab } from "@/store/repositories/entities/tab";
import {
    clearRecentlyClosedTabs,
    MAX_RECENTLY_CLOSED_TABS,
    rememberClosedTab,
    takeRecentlyClosedTab,
} from "./recently-closed-tabs";

const createTab = (id: string): Tab => ({
    id,
    noteId: `note-${id}`,
    order: 0,
    project: "workspace",
    type: "tab",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    scrollY: 0,
});

describe("recently closed tabs", () => {
    beforeEach(clearRecentlyClosedTabs);

    it("restores tabs in most-recently-closed order", () => {
        rememberClosedTab(createTab("first"));
        rememberClosedTab(createTab("second"));

        expect(takeRecentlyClosedTab()?.id).toBe("second");
        expect(takeRecentlyClosedTab()?.id).toBe("first");
        expect(takeRecentlyClosedTab()).toBeNull();
    });

    it("keeps only the last three closed tabs", () => {
        for (let i = 1; i <= MAX_RECENTLY_CLOSED_TABS + 1; i++) {
            rememberClosedTab(createTab(String(i)));
        }

        expect([
            takeRecentlyClosedTab()?.id,
            takeRecentlyClosedTab()?.id,
            takeRecentlyClosedTab()?.id,
            takeRecentlyClosedTab(),
        ]).toEqual(["4", "3", "2", null]);
    });
});
