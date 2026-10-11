import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompletionItem } from "./editor-completion-data";
import { createCompletionMenu, type CompletionAdapter } from "./editor-completion-menu";

const mocks = vi.hoisted(() => ({ load: vi.fn(), workspace: "/workspace" }));
vi.mock("@/store/global.store", () => ({
    globalState: () => ({ directory: mocks.workspace }),
    getWorkspaceKey: (root: string) => root,
    repositories: {},
}));
vi.mock("./editor-completion-data", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./editor-completion-data")>()),
    loadWorkspaceCompletions: mocks.load,
}));
vi.mock("@floating-ui/dom", () => ({
    computePosition: async () => ({ x: 0, y: 0 }),
    flip: () => ({}),
    shift: () => ({}),
}));

let menu: ReturnType<typeof createCompletionMenu>;
let adapter: CompletionAdapter;
const file: CompletionItem = { id: "file:one.md", label: "one.md", path: "one.md", kind: "file" };
const open = (repeat = false): boolean =>
    menu.handleKeyDown(new KeyboardEvent("keydown", { ctrlKey: true, code: "Space", repeat, cancelable: true }));

beforeEach(() => {
    mocks.workspace = "/workspace";
    mocks.load.mockReset();
    const target = document.createElement("div");
    target.setAttribute("role", "textbox");
    document.body.append(target);
    adapter = {
        noteId: () => "editing-note",
        target,
        context: () => ({ trigger: "@", query: "", from: 0, to: 1, cursor: 1 }),
        headings: () => [],
        tags: () => [],
        words: () => [],
        rect: () => new DOMRect(),
        insert: vi.fn(),
    };
    menu = createCompletionMenu(adapter);
});

afterEach(() => {
    menu.destroy();
    adapter.target.remove();
});

describe("completion request lifecycle", () => {
    it("keeps dismissed requests closed when their results arrive", async () => {
        let resolve: ((items: CompletionItem[]) => void) | undefined;
        mocks.load.mockReturnValue(
            new Promise<CompletionItem[]>((done) => {
                resolve = done;
            }),
        );
        expect(open()).toBe(true);
        expect(mocks.load).toHaveBeenCalledWith("@", "editing-note");
        expect(document.querySelector('[role="status"]')).toHaveTextContent("Loading");
        menu.handleKeyDown(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
        resolve?.([file]);
        await Promise.resolve();
        expect(document.querySelector('[role="listbox"]')).toBeNull();
        expect(adapter.target).not.toHaveAttribute("aria-controls");
        expect(adapter.insert).not.toHaveBeenCalled();
    });

    it("rejects a selection when its workspace has changed", async () => {
        mocks.load.mockResolvedValue([file]);
        open();
        await vi.waitFor(() => expect(document.querySelector('[role="option"]')).toHaveTextContent("one.md"));
        mocks.workspace = "/other-workspace";
        menu.handleKeyDown(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
        expect(adapter.insert).not.toHaveBeenCalled();
        expect(document.querySelector('[role="listbox"]')).toBeNull();
    });

    it("discards loaded results after switching workspaces", async () => {
        let resolve: ((items: CompletionItem[]) => void) | undefined;
        mocks.load.mockReturnValue(
            new Promise<CompletionItem[]>((done) => {
                resolve = done;
            }),
        );
        open();
        mocks.workspace = "/other-workspace";
        resolve?.([file]);
        await Promise.resolve();
        expect(document.querySelector('[role="listbox"]')).toBeNull();
    });

    it("does not restart a pending scan when the shortcut repeats", () => {
        mocks.load.mockReturnValue(new Promise<CompletionItem[]>(() => {}));
        open();
        expect(open(true)).toBe(true);
        expect(mocks.load).toHaveBeenCalledTimes(1);
    });
});
