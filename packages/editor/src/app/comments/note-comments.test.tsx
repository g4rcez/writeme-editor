import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { act, render, waitFor } from "@testing-library/react";
import { Profiler } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { NoteComments } from "./note-comments";

vi.mock("@/store/global.store", () => ({
    useGlobalStore: () => [{ notes: [] }, { syncNoteFromRepository: vi.fn() }],
}));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));
vi.mock("./comment-repository", () => ({
    loadCommentNote: async () => null,
    saveNoteComment: vi.fn(),
}));
vi.mock("../components/formatting-toolbar", () => ({ FormattingToolbar: () => null }));

describe("comment transaction subscriptions", () => {
    it("does not rerender or rescan anchors for selection and metadata-only transactions", async () => {
        const editor = new Editor({ extensions: [StarterKit], content: "<p>Plain text</p>" });
        const note = Note.new("Plain note", "Plain text");
        const committed = vi.fn();
        const { unmount } = render(
            <MemoryRouter>
                <Profiler id="comments" onRender={committed}>
                    <NoteComments editor={editor} note={note} readonly={false}
                        onSaveSource={vi.fn()} onSourcePersisted={vi.fn()} />
                </Profiler>
            </MemoryRouter>,
        );
        try {
            await waitFor(() => expect(editor.isInitialized).toBe(true));
            committed.mockClear();
            const scan = vi.spyOn(editor.state.doc, "descendants");
            act(() => {
                editor.commands.setTextSelection(4);
                editor.view.dispatch(editor.state.tr.setMeta("unrelated", true));
            });
            expect(committed).not.toHaveBeenCalled();
            expect(scan).not.toHaveBeenCalled();
            scan.mockRestore();
            act(() => editor.view.dispatch(editor.state.tr.insertText("!")));
            expect(committed).toHaveBeenCalledTimes(1);
        } finally {
            unmount();
            editor.destroy();
        }
    });
});
