import { describe, expect, it } from "vitest";
import {
    getTabNavigationShortcut,
    isCommanderShortcut,
    isNewAiChatShortcut,
    isNewNoteShortcut,
} from "./keyboard-shortcuts";

const event = (
    overrides: Partial<Parameters<typeof isCommanderShortcut>[0]>,
): Parameters<typeof isCommanderShortcut>[0] => ({
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: "",
    ...overrides,
});

describe("keyboard shortcuts", () => {
    it("matches Ctrl+Shift+P", () => {
        expect(isCommanderShortcut(event({ ctrlKey: true, shiftKey: true, key: "P" }))).toBe(true);
    });

    it("matches Cmd+Shift+P", () => {
        expect(isCommanderShortcut(event({ metaKey: true, shiftKey: true, key: "P" }))).toBe(true);
    });

    it("does not match without Shift", () => {
        expect(isCommanderShortcut(event({ ctrlKey: true, key: "p" }))).toBe(false);
    });

    it("does not match a different key", () => {
        expect(isCommanderShortcut(event({ ctrlKey: true, shiftKey: true, key: "k" }))).toBe(false);
    });

    it("matches Ctrl/Cmd+Shift+N for a new AI chat", () => {
        expect(isNewAiChatShortcut(event({ ctrlKey: true, shiftKey: true, key: "N" }))).toBe(true);
        expect(isNewAiChatShortcut(event({ metaKey: true, shiftKey: true, key: "n" }))).toBe(true);
    });

    it("does not match new note when Shift is pressed", () => {
        expect(isNewNoteShortcut(event({ ctrlKey: true, key: "n" }))).toBe(true);
        expect(isNewNoteShortcut(event({ ctrlKey: true, shiftKey: true, key: "n" }))).toBe(false);
    });

    it("matches Ctrl/Cmd+1-8 as indexed tab navigation", () => {
        expect(getTabNavigationShortcut(event({ ctrlKey: true, key: "1" }))).toStrictEqual({
            type: "index",
            index: 0,
        });
        expect(getTabNavigationShortcut(event({ metaKey: true, key: "8" }))).toStrictEqual({
            type: "index",
            index: 7,
        });
    });

    it("matches Ctrl/Cmd+9 as last tab navigation", () => {
        expect(getTabNavigationShortcut(event({ ctrlKey: true, key: "9" }))).toStrictEqual({
            type: "last",
        });
        expect(getTabNavigationShortcut(event({ metaKey: true, key: "9" }))).toStrictEqual({
            type: "last",
        });
    });

    it("rejects tab number shortcuts with unsupported modifiers or invalid numbers", () => {
        expect(getTabNavigationShortcut(event({ key: "1" }))).toBeNull();
        expect(getTabNavigationShortcut(event({ ctrlKey: true, shiftKey: true, key: "1" }))).toBeNull();
        expect(getTabNavigationShortcut(event({ ctrlKey: true, altKey: true, key: "1" }))).toBeNull();
        expect(getTabNavigationShortcut(event({ ctrlKey: true, key: "0" }))).toBeNull();
        expect(getTabNavigationShortcut(event({ ctrlKey: true, key: "n" }))).toBeNull();
    });
});
