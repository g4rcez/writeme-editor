import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    appOn: vi.fn(),
    fromWebContents: vi.fn(),
    buildFromTemplate: vi.fn(),
    popup: vi.fn(),
}));

vi.mock("electron", () => ({
    app: { on: mocks.appOn },
    BrowserWindow: { fromWebContents: mocks.fromWebContents },
    Menu: { buildFromTemplate: mocks.buildFromTemplate },
}));

import { registerSpellingContextMenus } from "./spelling-context-menu";

type MenuItem = {
    label?: string;
    role?: string;
    type?: string;
    click?: () => void;
};

type TestWebContents = EventEmitter & {
    isDestroyed: ReturnType<typeof vi.fn>;
    replaceMisspelling: ReturnType<typeof vi.fn>;
    send: (channel: string) => void;
    session: { addWordToSpellCheckerDictionary: ReturnType<typeof vi.fn> };
};

function createWebContents(): TestWebContents {
    return Object.assign(new EventEmitter(), {
        isDestroyed: vi.fn(() => false),
        replaceMisspelling: vi.fn(),
        send: vi.fn(),
        session: { addWordToSpellCheckerDictionary: vi.fn() },
    });
}

function attachContextMenu(contents: TestWebContents): void {
    const registerWebContents = mocks.appOn.mock.calls.find(([name]) => name === "web-contents-created")?.[1] as
        | ((event: unknown, contents: TestWebContents) => void)
        | undefined;
    if (!registerWebContents) throw new Error("Spelling context menu listener was not registered.");
    registerWebContents({}, contents);
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildFromTemplate.mockReturnValue({ popup: mocks.popup });
});

describe("native spelling context menus", () => {
    it("replaces a misspelled word, offers dictionary registration, and keeps standard edit roles", () => {
        const contents = createWebContents();
        const owner = { isDestroyed: vi.fn(() => false) };
        mocks.fromWebContents.mockReturnValue(owner);
        registerSpellingContextMenus();
        attachContextMenu(contents);
        const event = { preventDefault: vi.fn() };

        contents.emit("context-menu", event, {
            isEditable: true,
            dictionarySuggestions: ["misspelling"],
            misspelledWord: "mispeling",
            x: 12,
            y: 18,
        });

        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(mocks.popup).toHaveBeenCalledWith({ window: owner, x: 12, y: 18 });
        const template = mocks.buildFromTemplate.mock.calls[0]?.[0] as MenuItem[];
        template.find((item) => item.label === "misspelling")?.click?.();
        template.find((item) => item.label === "Add to dictionary")?.click?.();

        expect(contents.replaceMisspelling).toHaveBeenCalledWith("misspelling");
        expect(contents.session.addWordToSpellCheckerDictionary).toHaveBeenCalledWith("mispeling");
        expect(template.filter((item) => item.role).map((item) => item.role)).toEqual([
            "undo",
            "redo",
            "cut",
            "copy",
            "paste",
            "delete",
            "selectAll",
        ]);
    });

    it("still shows edit actions when the spellchecker has no alternatives", () => {
        const contents = createWebContents();
        mocks.fromWebContents.mockReturnValue({ isDestroyed: () => false });
        registerSpellingContextMenus();
        attachContextMenu(contents);

        contents.emit("context-menu", { preventDefault: vi.fn() }, { isEditable: true, dictionarySuggestions: [] });

        const template = mocks.buildFromTemplate.mock.calls[0]?.[0] as MenuItem[];
        expect(template[0]?.role).toBe("undo");
        expect(template.some((item) => item.role === "selectAll")).toBe(true);
        expect(template.some((item) => item.label === "Add to dictionary")).toBe(false);
    });
    it("adds a native selected-text review action without removing standard edit roles", () => {
        const contents = createWebContents();
        const owner = { isDestroyed: vi.fn(() => false) };
        mocks.fromWebContents.mockReturnValue(owner);
        registerSpellingContextMenus();
        attachContextMenu(contents);

        contents.emit(
            "context-menu",
            { preventDefault: vi.fn() },
            { isEditable: true, selectionText: "Selected prose", dictionarySuggestions: [] },
        );

        const template = mocks.buildFromTemplate.mock.calls[0]?.[0] as MenuItem[];
        template.find((item) => item.label === "Improve selected text")?.click?.();

        expect(contents.send).toHaveBeenCalledWith("writing-assistant:improve-selection");
        expect(template.filter((item) => item.role).map((item) => item.role)).toEqual([
            "undo",
            "redo",
            "cut",
            "copy",
            "paste",
            "delete",
            "selectAll",
        ]);
    });

    it("does not offer text improvement without a non-empty selection", () => {
        const contents = createWebContents();
        mocks.fromWebContents.mockReturnValue({ isDestroyed: () => false });
        registerSpellingContextMenus();
        attachContextMenu(contents);

        contents.emit("context-menu", { preventDefault: vi.fn() }, { isEditable: true, selectionText: "   " });

        const template = mocks.buildFromTemplate.mock.calls[0]?.[0] as MenuItem[];
        expect(template.some((item) => item.label === "Improve selected text")).toBe(false);
    });

    it("leaves noneditable and unowned web contents to their existing context behavior", () => {
        const contents = createWebContents();
        const event = { preventDefault: vi.fn() };
        registerSpellingContextMenus();
        attachContextMenu(contents);
        contents.emit("context-menu", event, { isEditable: false, dictionarySuggestions: ["replacement"] });

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(mocks.buildFromTemplate).not.toHaveBeenCalled();

        mocks.fromWebContents.mockReturnValue(null);
        contents.emit("context-menu", event, { isEditable: true, dictionarySuggestions: [] });
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(mocks.buildFromTemplate).not.toHaveBeenCalled();
    });
});
