import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note, NoteType } from "@/store/note";
import { useSidebarNotes } from "./use-sidebar-notes";
import { notifyHashtagsChanged } from "@/lib/hashtag-events";

const mocks = vi.hoisted(() => ({
    state: { notes: [] as Note[], directory: null },
    layout: { activeActivity: "explorer", activeView: { type: "all" }, searchQuery: "" },
    getHashtags: vi.fn(),
}));
vi.mock("@/store/global.store", () => ({ useGlobalStore: () => [mocks.state] }));
vi.mock("@/app/contexts/layout-context", () => ({ useLayoutStore: () => [mocks.layout] }));
vi.mock("@/store/repositories", () => ({ repositories: { hashtags: { getAll: mocks.getHashtags } } }));

beforeEach(() => {
    mocks.state.notes = [];
    mocks.layout = { activeActivity: "explorer", activeView: { type: "all" }, searchQuery: "" };
    mocks.getHashtags.mockReset().mockResolvedValue([]);
});

describe("sidebar note projections", () => {
    it("keeps current content, deduplicates notes, and does not reload tags on content changes", async () => {
        const old = Note.new("Note", "Old content");
        const latest = Note.parse({ ...old, content: "Current content", updatedAt: new Date(+old.updatedAt + 1000) });
        mocks.state.notes = [old, latest];
        const { result, rerender } = renderHook(() => useSidebarNotes());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.notes).toHaveLength(1);
        expect(result.current.notes[0]?.content).toBe("Current content");
        mocks.state.notes = [Note.parse({ ...latest, content: "Latest content" })];
        rerender();
        expect(result.current.loading).toBe(false);
        expect(result.current.notes[0]?.content).toBe("Latest content");
        expect(mocks.getHashtags).toHaveBeenCalledTimes(1);
    });

    it("updates tag-filtered results after committed tag changes", async () => {
        const note = Note.new("Tagged", "");
        mocks.state.notes = [note];
        mocks.layout = { activeActivity: "tags", activeView: { type: "tag", id: "new-tag" } as never, searchQuery: "" };
        const { result } = renderHook(() => useSidebarNotes());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.notes).toEqual([]);
        mocks.getHashtags.mockResolvedValueOnce([{ filename: note.title, hashtag: "new-tag" }]);
        act(() => notifyHashtagsChanged());
        await waitFor(() => expect(result.current.notes[0]?.id).toBe(note.id));
    });

    it("preserves the Read It Later activity filter", async () => {
        const normal = Note.new("Normal", "");
        const saved = Note.new("Saved", "", NoteType["read-it-later"]);
        mocks.state.notes = [normal, saved];
        mocks.layout.activeActivity = "read-it-later";
        const { result } = renderHook(() => useSidebarNotes());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.notes.map((note) => note.id)).toEqual([saved.id]);
    });
});
