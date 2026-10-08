import { describe, expect, it } from "vitest";
import { createApplicationMenuTemplate } from "./application-menu";

describe("application menu", () => {
    it("keeps existing app actions and exposes the native DevTools action in production", () => {
        const appItems = [{ label: "AI settings", click: (): void => undefined }];
        expect(createApplicationMenuTemplate(appItems)).toEqual([
            { label: "Writeme", submenu: appItems },
            { label: "View", submenu: [{ role: "toggleDevTools" }] },
        ]);
        expect(appItems).toHaveLength(1);
    });

    it("keeps DevTools available when there are no app actions", () => {
        expect(createApplicationMenuTemplate([])).toEqual([
            { label: "Writeme", submenu: [] },
            { label: "View", submenu: [{ role: "toggleDevTools" }] },
        ]);
    });
});
