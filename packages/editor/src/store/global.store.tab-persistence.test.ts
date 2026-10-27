import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tab } from "./repositories/entities/tab";
import { flushTabPersistence, globalDispatch, globalState, hasPendingTabPersistence, repositories } from "./global.store";
import { Note } from "./note";
import { SettingsService } from "./settings";
import { uiDispatch } from "./ui.store";

vi.mock("./repositories", () => ({
    repositories: {
        tabs: { save: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(), deleteByNoteId: vi.fn() },
        notes: { getOne: vi.fn(), update: vi.fn(), delete: vi.fn(), hardDelete: vi.fn() },
        terminalSessions: { getOne: vi.fn(), save: vi.fn(), delete: vi.fn() },
    },
}));
vi.mock("./settings", () => ({ SettingsService: { save: vi.fn() } }));
vi.mock("./ui.store", () => ({ uiDispatch: { setConfirm: vi.fn(), clearConfirm: vi.fn(), setError: vi.fn() } }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));

const releaseGates: Array<() => void> = [];
function gate() {
    let resolve = (): void => {};
    const promise = new Promise<void>((done) => { resolve = done; });
    releaseGates.push(resolve);
    return { promise, resolve };
}

function retryFailedWrites(): void {
    const calls = vi.mocked(uiDispatch.setConfirm).mock.calls;
    const confirm = calls.at(-1)?.[0];
    if (!confirm) throw new Error("Missing persistence retry prompt.");
    confirm.onConfirm();
}

describe("background tab persistence", () => {
    const saved = new Map<string, Tab>();
    beforeEach(async () => {
        vi.clearAllMocks();
        saved.clear();
        vi.mocked(repositories.tabs.save).mockImplementation(async (tab) => {
            saved.set(tab.id, tab);
            return tab;
        });
        vi.mocked(repositories.tabs.delete).mockImplementation(async (id) => saved.delete(id));
        vi.mocked(repositories.tabs.updateOrder).mockImplementation(async (tabs) => {
            for (const tab of tabs) if (saved.has(tab.id)) saved.set(tab.id, tab);
        });
        vi.mocked(repositories.tabs.deleteByNoteId).mockImplementation(async (noteId) => {
            for (const tab of saved.values()) {
                if (tab.noteId === noteId && tab.type === "tab") saved.delete(tab.id);
            }
        });
        vi.mocked(repositories.notes.getOne).mockResolvedValue(null);
        vi.mocked(repositories.terminalSessions.getOne).mockResolvedValue(null);
        vi.mocked(repositories.terminalSessions.save).mockImplementation(async (session) => session);
        vi.mocked(repositories.terminalSessions.delete).mockResolvedValue(true);
        await globalDispatch.init("dark", [], [], 16, 320, null, null, []);
        globalDispatch.setNote(null);
        globalDispatch.activeTabId(null);
    });

    afterEach(async () => {
        for (const release of releaseGates.splice(0)) release();
        try {
            await flushTabPersistence();
        } catch {
            retryFailedWrites();
            await flushTabPersistence();
        }
    });

    it("opens and closes immediately while a save is blocked, without resurrecting the tab", async () => {
        const started = gate();
        const pending = gate();
        vi.mocked(repositories.tabs.save).mockImplementationOnce(async (tab) => {
            started.resolve();
            await pending.promise;
            saved.set(tab.id, tab);
            return tab;
        });
        globalDispatch.addTab("first");
        const tab = globalState().tabs[0];
        if (!tab) throw new Error("Tab was not opened synchronously.");
        expect(globalState().activeTabId).toBe(tab.id);
        await started.promise;
        globalDispatch.removeTab(tab.id);
        expect(globalState().tabs).toEqual([]);
        expect(repositories.tabs.delete).not.toHaveBeenCalled();
        pending.resolve();
        await flushTabPersistence();
        expect(saved.size).toBe(0);
        expect(globalState().tabs).toEqual([]);
        expect(repositories.notes.update).not.toHaveBeenCalled();
    });

    it("deduplicates rapid opens and selects loaded notes without waiting for storage", async () => {
        const first = Note.new("First", "First draft");
        const second = Note.new("Second", "Second draft");
        globalDispatch.notes([first, second]);
        globalDispatch.selectNoteById(first.id);
        globalDispatch.selectNoteById(second.id);
        globalDispatch.selectNoteById(first.id);
        expect(globalState().note).toBe(first);
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual([first.id, second.id]);
        expect(repositories.notes.getOne).not.toHaveBeenCalled();
        await flushTabPersistence();
        expect(repositories.tabs.save).toHaveBeenCalledTimes(2);
        expect(globalState().note).toBe(first);
    });

    it("ignores a late cold-note selection after a newer selection", async () => {
        const pending = gate();
        const first = Note.new("First", "First");
        const second = Note.new("Second", "Second");
        vi.mocked(repositories.notes.getOne).mockImplementationOnce(async () => {
            await pending.promise;
            return first;
        });
        const selecting = globalDispatch.selectNoteById(first.id);
        globalDispatch.notes([second]);
        globalDispatch.selectNoteById(second.id);
        pending.resolve();
        await selecting;
        expect(globalState().note).toBe(second);
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual([second.id]);
    });

    it("does not overwrite a selection made between lookup completion and dispatcher completion", async () => {
        const first = Note.new("First", "First");
        const second = Note.new("Second", "Second");
        globalDispatch.notes([second]);
        vi.mocked(repositories.notes.getOne).mockResolvedValueOnce(first);
        const selecting = globalDispatch.selectNoteById(first.id);
        queueMicrotask(() => globalDispatch.selectNoteById(second.id));
        await selecting;
        expect(globalState().note).toBe(second);
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual([first.id, second.id]);
    });

    it("does not restore a terminal session when renaming and closing in the same turn", async () => {
        await globalDispatch.addTerminalTab("terminal");
        const tab = globalState().tabs[0];
        if (!tab) throw new Error("Missing terminal tab.");
        const renaming = globalDispatch.renameTerminalSession("terminal", "New title");
        globalDispatch.removeTab(tab.id);
        await renaming;
        await flushTabPersistence();
        expect(globalState().terminalSessions).toEqual([]);
        expect(globalState().tabs).toEqual([]);
        expect(saved.size).toBe(0);
    });

    it("cleans up tabs reopened while note deletion is in progress", async () => {
        const note = Note.new("Deleted note", "Saved content");
        globalDispatch.notes([note]);
        globalDispatch.addTab(note.id);
        await flushTabPersistence();
        const started = gate();
        const pending = gate();
        vi.mocked(repositories.notes.delete).mockImplementationOnce(async () => {
            started.resolve();
            await pending.promise;
            return true;
        });
        const deleting = globalDispatch.deleteNote(note.id);
        await started.promise;
        const tab = globalState().tabs[0];
        if (!tab) throw new Error("Missing tab.");
        globalDispatch.removeTab(tab.id);
        globalDispatch.addTab(note.id);
        pending.resolve();
        await deleting;
        await flushTabPersistence();
        expect(globalState().tabs).toEqual([]);
        expect(saved.size).toBe(0);
    });

    it("persists reorders after opens and does not restore tabs from a stale drag list", async () => {
        globalDispatch.addTab("first");
        globalDispatch.addTab("second");
        const original = globalState().tabs;
        const second = original.find((tab) => tab.noteId === "second");
        if (!second) throw new Error("Missing second tab.");
        globalDispatch.reorderTabs([...original].reverse());
        globalDispatch.removeTab(second.id);
        globalDispatch.addTab("third");
        globalDispatch.reorderTabs([...original].reverse());
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual(["first", "third"]);
        await flushTabPersistence();
        expect([...saved.values()].sort((a, b) => a.order - b.order)).toEqual(globalState().tabs);
    });

    it("keeps optimistic state on failure and retries writes without changing the latest selection", async () => {
        vi.mocked(repositories.tabs.save).mockRejectedValueOnce(new Error("Disk unavailable"));
        globalDispatch.addTab("first");
        await expect(flushTabPersistence()).rejects.toThrow("Disk unavailable");
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual(["first"]);
        expect(hasPendingTabPersistence()).toBe(true);
        expect(uiDispatch.setConfirm).toHaveBeenCalledWith(expect.objectContaining({
            title: "Tab changes not saved",
            confirmText: "Retry saving",
        }));
        globalDispatch.addTab("second");
        const selected = globalState().activeTabId;
        retryFailedWrites();
        await flushTabPersistence();
        expect(globalState().activeTabId).toBe(selected);
        expect(saved.size).toBe(2);
        expect(hasPendingTabPersistence()).toBe(false);
    });

    it("blocks a workspace switch when queued writes fail", async () => {
        vi.mocked(repositories.tabs.save).mockRejectedValueOnce(new Error("Disk unavailable"));
        globalDispatch.addTab("first");
        await expect(globalDispatch.switchWorkspace("/next")).rejects.toThrow("Disk unavailable");
        expect(SettingsService.save).not.toHaveBeenCalled();
        expect(globalState().directory).toBeNull();
    });

    it("waits for pending writes before changing workspace settings", async () => {
        const pending = gate();
        vi.mocked(repositories.tabs.save).mockImplementationOnce(async (tab) => {
            await pending.promise;
            saved.set(tab.id, tab);
            return tab;
        });
        vi.mocked(SettingsService.save).mockRejectedValueOnce(new Error("stop before reload"));
        globalDispatch.addTab("first");
        const switching = globalDispatch.switchWorkspace("/next");
        const checked = expect(switching).rejects.toThrow("stop before reload");
        expect(SettingsService.save).not.toHaveBeenCalled();
        pending.resolve();
        await checked;
        expect(saved.size).toBe(1);
        expect(SettingsService.save).toHaveBeenCalledWith({ directory: "/next", explorerRoot: "/next" });
    });

    it("serializes terminal session creation and tab deletion", async () => {
        const pending = gate();
        vi.mocked(repositories.terminalSessions.save).mockImplementationOnce(async (session) => {
            await pending.promise;
            return session;
        });
        await globalDispatch.addTerminalTab("terminal");
        const tab = globalState().tabs[0];
        if (!tab) throw new Error("Missing terminal tab.");
        globalDispatch.removeTab(tab.id);
        expect(globalState().terminalSessions).toEqual([]);
        expect(repositories.terminalSessions.delete).not.toHaveBeenCalled();
        pending.resolve();
        await flushTabPersistence();
        expect(saved.size).toBe(0);
        expect(repositories.terminalSessions.delete).toHaveBeenCalledWith("terminal");
    });

    it("does not reopen a terminal when its lookup completes after another tab is selected", async () => {
        const pending = gate();
        vi.mocked(repositories.terminalSessions.getOne).mockImplementationOnce(async () => {
            await pending.promise;
            return null;
        });
        const opening = globalDispatch.addTerminalTab("terminal");
        globalDispatch.addTab("note");
        pending.resolve();
        await opening;
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual(["note"]);
        expect(globalState().terminalSessions).toEqual([]);
    });

    it("clears pending tabs before persisting newly opened tabs", async () => {
        globalDispatch.addTab("first");
        globalDispatch.addTab("second");
        globalDispatch.clearTabs();
        globalDispatch.addTab("third");
        expect(globalState().tabs.map((tab) => tab.noteId)).toEqual(["third"]);
        await flushTabPersistence();
        expect([...saved.values()]).toEqual(globalState().tabs);
    });
});
