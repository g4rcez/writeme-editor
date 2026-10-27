import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (hash: string) => {
    vi.resetModules();
    window.location.hash = hash;
    return import("./window-mode");
};

afterEach(() => {
    window.location.hash = "";
});

describe("isSecondaryWindow", () => {
    it.each(["#/quicknote", "#quicknote", "#/mathnote", "#/floating-editor", "#/floating-editor?note=1"])(
        "treats %s as a secondary window",
        async (hash) => {
            expect((await load(hash)).isSecondaryWindow).toBe(true);
        },
    );

    it.each(["", "#/", "#/note/abc", "#/settings", "#/quicknotes-archive"])("treats %s as the main window", async (hash) => {
        expect((await load(hash)).isSecondaryWindow).toBe(false);
    });
});
