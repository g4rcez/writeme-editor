import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Note, NoteType } from "@/store/note";
import type { EditorMode } from "../editor";
import type { EditorPaneState } from "../hooks/use-editor-panes";
import { EditorPanes } from "./editor-panes";

vi.mock("../editor", () => ({
    Editor: ({ note, active, mode }: { note: Note; active: boolean; mode: EditorMode }) => (
        <div role="textbox" aria-label={`Editor for ${note.title}`} tabIndex={0} data-active={active} data-mode={mode}>
            {note.content}
        </div>
    ),
}));

beforeEach(() => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function createProps() {
    const first = Note.new("First note", "First document");
    const second = Note.new("Second note", "Second document");
    const state: EditorPaneState = {
        rootNoteId: first.id,
        activePaneId: "pane-a",
        panes: [
            { id: "pane-a", noteId: first.id },
            { id: "pane-b", noteId: second.id },
        ],
    };
    return {
        state,
        currentNote: first,
        notes: [first, second],
        editorMode: "formatted" as const,
        rawEditorVimMode: false,
        canAdd: true,
        onActivate: vi.fn(),
        onSelectNote: vi.fn(),
        onAdd: vi.fn(),
        onRemove: vi.fn(),
        onExit: vi.fn(),
    };
}

describe("editor groups", () => {
    it("shows independent documents and the active group", () => {
        const props = createProps();
        render(<EditorPanes {...props} />);

        expect(screen.getByRole("region", { name: "Editor groups" })).toBeVisible();
        expect(screen.getByRole("region", { name: "Editor group 1" })).toHaveAttribute("data-active", "true");
        expect(screen.getByRole("region", { name: "Editor group 2" })).toHaveAttribute("data-active", "false");
        expect(screen.getByRole("textbox", { name: "Editor for First note" })).toHaveTextContent("First document");
        expect(screen.getByRole("textbox", { name: "Editor for Second note" })).toHaveTextContent("Second document");
    });

    it("activates a group on pointer and keyboard focus", () => {
        const props = createProps();
        render(<EditorPanes {...props} />);

        fireEvent.pointerDown(screen.getByRole("region", { name: "Editor group 2" }));
        expect(props.onActivate).toHaveBeenLastCalledWith("pane-b");
        fireEvent.focus(screen.getByRole("textbox", { name: "Editor for First note" }));
        expect(props.onActivate).toHaveBeenLastCalledWith("pane-a");
    });

    it("switches only the chosen group's document", () => {
        const props = createProps();
        render(<EditorPanes {...props} />);

        fireEvent.change(screen.getByRole("combobox", { name: "Select note for pane 2" }), {
            target: { value: props.currentNote.id },
        });
        expect(props.onSelectNote).toHaveBeenCalledExactlyOnceWith("pane-b", props.currentNote.id);
    });

    it("keeps the current note selectable and excludes deleted or unsupported notes", () => {
        const props = createProps();
        const deleted = Note.new("Deleted note", "");
        deleted.deletedAt = new Date(0);
        render(
            <EditorPanes
                {...props}
                notes={[
                    props.notes[1]!,
                    deleted,
                    Note.new("JSON note", "{}", NoteType.json),
                    Note.new("Drawing", "", NoteType.excalidraw),
                ]}
            />,
        );

        const picker = screen.getByRole("combobox", { name: "Select note for pane 1" });
        expect(picker).toHaveValue(props.currentNote.id);
        expect(within(picker).getByRole("option", { name: "First note" })).toBeInTheDocument();
        expect(within(picker).getByRole("option", { name: "Second note" })).toBeInTheDocument();
        expect(within(picker).queryByRole("option", { name: "Deleted note" })).not.toBeInTheDocument();
        expect(within(picker).queryByRole("option", { name: "JSON note" })).not.toBeInTheDocument();
        expect(within(picker).queryByRole("option", { name: "Drawing" })).not.toBeInTheDocument();
    });

    it("preserves split limits and prevents closing the last editor", () => {
        const props = createProps();
        render(
            <EditorPanes
                {...props}
                canAdd={false}
                state={{
                    ...props.state,
                    panes: [{ id: "pane-a", noteId: props.currentNote.id }],
                }}
            />,
        );

        expect(screen.getByRole("button", { name: "Add editor pane" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Close pane 1" })).toBeDisabled();
    });

    it("provides group actions without a separate pane toolbar", () => {
        const props = createProps();
        render(<EditorPanes {...props} />);

        fireEvent.click(screen.getAllByRole("button", { name: "Add editor pane" })[0]!);
        expect(props.onAdd).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: "Close pane 2" }));
        expect(props.onRemove).toHaveBeenCalledExactlyOnceWith("pane-b");
        fireEvent.click(screen.getByRole("button", { name: "Editor group 1 actions" }));
        const actions = screen.getByRole("dialog", { name: "Editor group 1 actions" });
        expect(within(actions).getByRole("button", { name: "Grow editor group" })).toBeVisible();
        expect(within(actions).getByRole("button", { name: "Shrink editor group" })).toBeVisible();
        fireEvent.click(within(actions).getByRole("button", { name: "Single editor" }));
        expect(props.onExit).toHaveBeenCalledOnce();
    });
});
