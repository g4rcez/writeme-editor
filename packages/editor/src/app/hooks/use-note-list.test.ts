import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { useNoteList } from "./use-note-list";

const mocks = vi.hoisted(() => ({
    state: { notes: [] as Note[] },
    deleteNote: vi.fn(),
    confirm: vi.fn(),
    getHashtags: vi.fn(),
}));

vi.mock("@g4rcez/components", () => ({ Modal: { confirm: mocks.confirm } }));
vi.mock("@/store/global.store", () => ({
    useGlobalStore: () => [mocks.state, { deleteNote: mocks.deleteNote }],
}));
vi.mock("@/store/repositories", () => ({ repositories: { hashtags: { getAll: mocks.getHashtags } } }));
vi.mock("@/app/notification-ref", () => ({ notificationRef: { current: null } }));

describe("useNoteList Trash confirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.state.notes = [Note.new("First note", ""), Note.new("Second note", "")];
        mocks.getHashtags.mockResolvedValue([]);
        mocks.confirm.mockResolvedValue(true);
        mocks.deleteNote.mockResolvedValue(undefined);
    });

    it.each([1, 2])("explains recovery when moving %i notes to Trash", async (count) => {
        const { result } = renderHook(() => useNoteList());
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => {
            for (const note of mocks.state.notes.slice(0, count)) result.current.toggleSelection(note.id);
        });
        await act(async () => { await result.current.handleBatchDelete(); });

        expect(mocks.confirm).toHaveBeenCalledWith({
            title: `Move ${count} ${count === 1 ? "note" : "notes"} to Trash?`,
            description: "You can restore them from Trash.",
            confirm: { text: "Move to Trash", theme: "danger" },
        });
        expect(mocks.deleteNote).toHaveBeenCalledTimes(count);
        expect(result.current.selectedIds.size).toBe(0);
    });

    it("keeps notes and selection when the user cancels", async () => {
        mocks.confirm.mockResolvedValue(false);
        const { result } = renderHook(() => useNoteList());
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.selectAll());
        await act(async () => { await result.current.handleBatchDelete(); });

        expect(mocks.deleteNote).not.toHaveBeenCalled();
        expect(result.current.selectedIds.size).toBe(2);
    });
});
