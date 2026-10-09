import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Note, NoteType } from "@/store/note";
import { clearEditorPaneState, useEditorPanes } from "./use-editor-panes";

beforeEach(clearEditorPaneState);

function setup() {
    const notes = [
        Note.new("First", "First content"),
        Note.new("Second", "Second content"),
        Note.new("Third", "Third content"),
    ];
    const root = notes[0]!;
    const hook = renderHook(() =>
        useEditorPanes(
            root.id,
            notes,
            notes.map((note) => note.id),
        ),
    );
    return { ...hook, notes, root };
}

describe("editor tab movement", () => {
    it("enforces the group limit while allowing relocation of a whole group", () => {
        const { result, notes } = setup();
        act(() => result.current.dropTab({ noteId: notes[1]!.id }, "right", false));
        act(() => result.current.add());
        act(() => result.current.add());
        expect(result.current.state!.panes).toHaveLength(4);
        const previous = result.current.state;
        const target = previous!.panes[0]!;
        const source = previous!.panes[1]!;
        act(() => result.current.dropTab({ noteId: source.noteId, paneId: source.id }, "top", true, target.id));
        expect(result.current.state).toBe(previous);
        act(() => result.current.dropTab({ noteId: source.noteId, paneId: source.id }, "top", false, target.id));
        expect(result.current.state!.panes).toHaveLength(4);
        expect(result.current.state!.panes.some((pane) => pane.id === source.id)).toBe(false);
    });
    it("keeps remaining open tabs in the source and supports nested split directions", () => {
        const { result, notes } = setup();
        act(() => result.current.dropTab({ noteId: notes[1]!.id }, "right", false));
        const first = result.current.state!.panes[0]!;
        expect(first.noteIds).toEqual([notes[0]!.id, notes[2]!.id]);
        act(() => result.current.dropTab({ noteId: notes[2]!.id, paneId: first.id }, "top", false, first.id));
        expect(result.current.state!.panes).toHaveLength(3);
        expect(result.current.state!.panes.find((pane) => pane.id === first.id)?.noteIds).toEqual([notes[0]!.id]);
        const layout = result.current.state!.layout;
        expect(layout?.type).toBe("split");
        if (layout?.type !== "split") throw new Error("Expected a split layout");
        expect(layout.children[0]).toMatchObject({ type: "split", orientation: "vertical" });
    });

    it("moves the final tab between groups and collapses the empty group", () => {
        const { result, notes } = setup();
        act(() => result.current.dropTab({ noteId: notes[1]!.id }, "left", false));
        const [first, second] = result.current.state!.panes;
        act(() => result.current.dropTab({ noteId: notes[1]!.id, paneId: second!.id }, "center", false, first!.id));
        expect(result.current.state!.panes).toHaveLength(1);
        expect(result.current.state!.panes[0]!.noteIds).toEqual([notes[0]!.id, notes[2]!.id, notes[1]!.id]);
        expect(result.current.state!.layout).toEqual({ type: "pane", id: first!.id });
    });

    it("copies with a modifier and removes only the closed group tab", () => {
        const { result, notes } = setup();
        act(() => result.current.dropTab({ noteId: notes[1]!.id }, "right", false));
        const source = result.current.state!.panes[1]!;
        act(() => result.current.dropTab({ noteId: source.noteId, paneId: source.id }, "bottom", true, source.id));
        expect(result.current.state!.panes.filter((pane) => pane.noteId === source.noteId)).toHaveLength(2);
        const added = result.current.state!.panes[2]!;
        act(() => result.current.closeTab(added.id, added.noteId));
        expect(result.current.state!.panes).toHaveLength(2);
        expect(result.current.state!.panes.find((pane) => pane.id === source.id)?.noteId).toBe(source.noteId);
    });

    it("reorders without duplicating tabs and ignores a drop onto itself", () => {
        const { result, notes } = setup();
        act(() => result.current.dropTab({ noteId: notes[1]!.id }, "right", false));
        const first = result.current.state!.panes[0]!;
        act(() =>
            result.current.dropTab({ noteId: notes[2]!.id, paneId: first.id }, "center", false, first.id, notes[0]!.id),
        );
        expect(result.current.state!.panes[0]!.noteIds).toEqual([notes[2]!.id, notes[0]!.id]);
        const previous = result.current.state;
        act(() =>
            result.current.dropTab({ noteId: notes[2]!.id, paneId: first.id }, "center", false, first.id, notes[2]!.id),
        );
        expect(result.current.state).toBe(previous);
    });

    it("rejects unavailable documents and moving a group's only tab onto its own edge", () => {
        const { result, notes } = setup();
        act(() => result.current.dropTab({ noteId: notes[1]!.id }, "right", false));
        const previous = result.current.state;
        const source = previous!.panes[1]!;
        act(() => result.current.dropTab({ noteId: source.noteId, paneId: source.id }, "top", false, source.id));
        expect(result.current.state).toBe(previous);
        act(() => result.current.dropTab({ noteId: Note.new("JSON", "{}", NoteType.json).id }, "left", false));
        expect(result.current.state).toBe(previous);
    });
});
