import { Button, Select } from "@g4rcez/components";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { Group, Panel, Separator } from "react-resizable-panels";
import { type Note, NoteType } from "@/store/note";
import type { EditorMode } from "../editor";
import type { EditorPane, EditorPaneState } from "../hooks/use-editor-panes";
import { Editor } from "../editor";

const paneNoteOptions = (notes: readonly Note[]) =>
    notes
        .filter(
            (note) =>
                note.deletedAt === null && note.noteType !== NoteType.json && note.noteType !== NoteType.excalidraw,
        )
        .map((note) => ({
            label: note.filePath ? `${note.title} · ${note.filePath}` : note.title,
            value: note.id,
        }));

type EditorPanesProps = {
    state: EditorPaneState;
    notes: readonly Note[];
    currentNote: Note;
    editorMode: EditorMode;
    rawEditorVimMode: boolean;
    onActivate: (paneId: string) => void;
    onSelectNote: (paneId: string, noteId: string) => void;
    onAdd: () => void;
    onRemove: (paneId: string) => void;
    onExit: () => void;
    canAdd: boolean;
};

function getPaneNote(pane: EditorPane, notes: readonly Note[], currentNote: Note): Note {
    if (pane.noteId === currentNote.id) return currentNote;
    return notes.find((note) => note.id === pane.noteId) ?? currentNote;
}

export function EditorPanes({
    state,
    notes,
    currentNote,
    editorMode,
    rawEditorVimMode,
    onActivate,
    onSelectNote,
    onAdd,
    onRemove,
    onExit,
    canAdd,
}: EditorPanesProps) {
    const options = paneNoteOptions(notes.some((note) => note.id === currentNote.id) ? notes : [...notes, currentNote]);

    return (
        <section className="mx-auto flex min-h-[60vh] w-full max-w-[clamp(32rem,120ch,100%)] min-w-0 flex-1 flex-col gap-2 py-4 print:block">
            <header className="flex min-h-9 items-center justify-between gap-3 border-b border-border/50 pb-2 print:hidden">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {state.panes.length} editor panes
                </p>
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        size="tiny"
                        theme="ghost-primary"
                        disabled={!canAdd}
                        aria-label="Add editor pane"
                        title={canAdd ? "Add editor pane" : "Maximum editor panes reached"}
                        onClick={onAdd}
                    >
                        <PlusIcon aria-hidden="true" size={16} />
                    </Button>
                    <Button type="button" size="tiny" theme="ghost-muted" onClick={onExit}>
                        Exit panes
                    </Button>
                </div>
            </header>
            <Group orientation="horizontal" className="min-h-0 flex-1 overflow-hidden">
                {state.panes.flatMap((pane, index) => {
                    const note = getPaneNote(pane, notes, currentNote);
                    const active = pane.id === state.activePaneId;
                    const panel = (
                        <Panel
                            key={pane.id}
                            defaultSize={100 / state.panes.length}
                            minSize={20}
                            className="min-w-0 overflow-hidden"
                        >
                            <PaneContent
                                pane={pane}
                                index={index}
                                note={note}
                                options={options}
                                active={active}
                                editorMode={editorMode}
                                rawEditorVimMode={rawEditorVimMode}
                                canClose={state.panes.length > 1}
                                onActivate={onActivate}
                                onSelectNote={onSelectNote}
                                onRemove={onRemove}
                            />
                        </Panel>
                    );
                    return index > 0
                        ? [
                              <Separator
                                  key={`${pane.id}:separator`}
                                  className="w-px cursor-col-resize bg-border/30"
                              />,
                              panel,
                          ]
                        : [panel];
                })}
            </Group>
        </section>
    );
}

type PaneContentProps = {
    pane: EditorPane;
    index: number;
    note: Note;
    options: Array<{ label: string; value: string }>;
    active: boolean;
    editorMode: EditorMode;
    rawEditorVimMode: boolean;
    canClose: boolean;
    onActivate: (paneId: string) => void;
    onSelectNote: (paneId: string, noteId: string) => void;
    onRemove: (paneId: string) => void;
};

function PaneContent({
    pane,
    index,
    note,
    options,
    active,
    editorMode,
    rawEditorVimMode,
    canClose,
    onActivate,
    onSelectNote,
    onRemove,
}: PaneContentProps) {
    return (
        <div
            className={`flex h-full min-h-0 min-w-0 flex-col rounded border ${active ? "border-primary/40" : "border-border/40"}`}
            onFocusCapture={() => onActivate(pane.id)}
        >
            <div className="flex min-h-10 items-center gap-2 border-b border-border/40 bg-card-background/40 px-2">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Pane {index + 1}
                </span>
                <Select
                    hiddenLabel
                    aria-label={`Select note for pane ${index + 1}`}
                    className="min-w-0 flex-1"
                    options={options}
                    value={note.id}
                    onChange={(event) => onSelectNote(pane.id, event.target.value)}
                />
                <Button
                    type="button"
                    size="tiny"
                    theme="ghost-muted"
                    disabled={!canClose}
                    aria-label={`Close pane ${index + 1}`}
                    title={canClose ? "Close pane" : "At least one pane must remain open"}
                    onClick={() => onRemove(pane.id)}
                >
                    <XIcon aria-hidden="true" size={15} />
                </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3">
                <Editor
                    id={pane.id}
                    note={note}
                    content={note.content || ""}
                    mode={editorMode}
                    rawEditorVimMode={rawEditorVimMode}
                    active={active}
                />
            </div>
        </div>
    );
}
