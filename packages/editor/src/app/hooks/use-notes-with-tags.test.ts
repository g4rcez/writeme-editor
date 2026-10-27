import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { Hashtag } from "@/store/repositories/entities/hashtag";
import { notifyHashtagsChanged } from "@/lib/hashtag-events";
import { useNotesWithTags } from "./use-notes-with-tags";

const { getHashtags } = vi.hoisted(() => ({ getHashtags: vi.fn() }));
vi.mock("@/store/repositories", () => ({ repositories: { hashtags: { getAll: getHashtags } } }));

function deferred<T>() {
    let resolve = (_value: T): void => {};
    let reject = (_reason: unknown): void => {};
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}
function tag(value: string, filename: string): Hashtag {
    return new Hashtag(value, value, filename, "default", new Date(), "hashtag", new Date());
}

beforeEach(() => { getHashtags.mockReset().mockResolvedValue([]); });
afterEach(() => vi.restoreAllMocks());

describe("note tag projections", () => {
    it("combines a pending tag read with the latest notes rather than captured notes", async () => {
        const pending = deferred<Hashtag[]>();
        getHashtags.mockReturnValueOnce(pending.promise);
        const old = Note.new("Stable title", "Old content");
        const updated = Note.parse({ ...old, content: "New content", tags: ["frontmatter"] });
        const { result, rerender } = renderHook(({ notes }) => useNotesWithTags(notes, null), {
            initialProps: { notes: [old] },
        });
        rerender({ notes: [updated] });
        await act(async () => { pending.resolve([tag("stored", updated.title)]); await pending.promise; });
        expect(result.current.notes[0]?.content).toBe("New content");
        expect(result.current.notes[0]?.tags).toEqual(["frontmatter", "stored"]);
        expect(getHashtags).toHaveBeenCalledTimes(1);
    });

    it("ignores an older refresh that completes after a newer refresh", async () => {
        const first = deferred<Hashtag[]>();
        const second = deferred<Hashtag[]>();
        const note = Note.new("Note", "");
        getHashtags.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result } = renderHook(() => useNotesWithTags([note], null));
        let refreshing: Promise<void> = Promise.resolve();
        act(() => { refreshing = result.current.refresh(); });
        await act(async () => { second.resolve([tag("new", note.title)]); await refreshing; });
        expect(result.current.notes[0]?.tags).toEqual(["new"]);
        await act(async () => { first.resolve([tag("old", note.title)]); await first.promise; });
        expect(result.current.notes[0]?.tags).toEqual(["new"]);
    });

    it("does not refetch tags or recreate unchanged rows on note edits", async () => {
        const first = Note.new("First", "Old content");
        const second = Note.new("Second", "Unchanged");
        const { result, rerender } = renderHook(({ notes }) => useNotesWithTags(notes, null), {
            initialProps: { notes: [first, second] },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        const previousSecond = result.current.notes[1];
        rerender({ notes: [Note.parse({ ...first, content: "Edited" }), second] });
        expect(result.current.loading).toBe(false);
        expect(result.current.notes[0]?.content).toBe("Edited");
        expect(result.current.notes[1]).toBe(previousSecond);
        expect(getHashtags).toHaveBeenCalledTimes(1);
    });

    it("refreshes committed tag changes without hiding loaded rows", async () => {
        const note = Note.new("Note", "");
        const pending = deferred<Hashtag[]>();
        const { result } = renderHook(() => useNotesWithTags([note], null));
        await waitFor(() => expect(result.current.loading).toBe(false));
        getHashtags.mockReturnValueOnce(pending.promise);
        act(() => notifyHashtagsChanged());
        expect(result.current.loading).toBe(false);
        expect(result.current.notes[0]?.title).toBe(note.title);
        await act(async () => { pending.resolve([tag("added", note.title)]); await pending.promise; });
        expect(result.current.notes[0]?.tags).toEqual(["added"]);
        getHashtags.mockResolvedValueOnce([]);
        act(() => notifyHashtagsChanged());
        await waitFor(() => expect(result.current.notes[0]?.tags).toEqual([]));
    });

    it("keeps tags and exposes errors when a refresh fails, then recovers", async () => {
        const note = Note.new("Note", "");
        getHashtags.mockResolvedValueOnce([tag("existing", note.title)]);
        const { result } = renderHook(() => useNotesWithTags([note], null));
        await waitFor(() => expect(result.current.loading).toBe(false));
        const failure = new Error("Storage unavailable");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        getHashtags.mockRejectedValueOnce(failure);
        await act(async () => { await result.current.refresh(); });
        expect(result.current.error).toBe(failure);
        expect(result.current.notes[0]?.tags).toEqual(["existing"]);
        expect(result.current.loading).toBe(false);
        expect(log).toHaveBeenCalledTimes(1);
        getHashtags.mockResolvedValueOnce([]);
        await act(async () => { await result.current.refresh(); });
        expect(result.current.error).toBeNull();
    });

    it("does not apply a previous workspace's tags", async () => {
        const first = deferred<Hashtag[]>();
        const second = deferred<Hashtag[]>();
        const note = Note.new("Same title", "");
        getHashtags.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result, rerender } = renderHook(({ directory }) => useNotesWithTags([note], directory), {
            initialProps: { directory: "/first" },
        });
        rerender({ directory: "/second" });
        await act(async () => { first.resolve([tag("first", note.title)]); await first.promise; });
        expect(result.current.notes[0]?.tags).toEqual([]);
        expect(result.current.loading).toBe(true);
        await act(async () => { second.resolve([tag("second", note.title)]); await second.promise; });
        expect(result.current.notes[0]?.tags).toEqual(["second"]);
    });

    it("ignores a pending read and removes the event listener on unmount", async () => {
        const pending = deferred<Hashtag[]>();
        getHashtags.mockReturnValueOnce(pending.promise);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { result, unmount } = renderHook(() => useNotesWithTags([], null));
        const refresh = result.current.refresh;
        unmount();
        await act(async () => { pending.reject(new Error("Late failure")); await pending.promise.catch(() => {}); });
        act(() => notifyHashtagsChanged());
        await act(async () => { await refresh(); });
        expect(log).not.toHaveBeenCalled();
        expect(getHashtags).toHaveBeenCalledTimes(1);
    });
});
