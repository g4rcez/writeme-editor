import { Button, Dropdown, Select } from "@g4rcez/components";
import { ColumnsIcon } from "@phosphor-icons/react/dist/csr/Columns";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { motion } from "motion/react";
import { type JSX, useEffect, useRef, useState } from "react";
import {
    Group,
    type GroupImperativeHandle,
    Panel,
    type PanelImperativeHandle,
    Separator,
} from "react-resizable-panels";
import { type EditorLayout, type EditorTabDrag, type EditorDropSide } from "@/lib/editor-tab-drag";
import { type Note, NoteType } from "@/store/note";
import type { EditorMode } from "../editor";
import type { EditorPane, EditorPaneState } from "../hooks/use-editor-panes";
import { Editor } from "../editor";
import { useMotionTabDrop } from "../hooks/use-motion-tab-drop";
import { EditorDropTarget } from "./editor-drop-target";
import { MotionEditorTab } from "./motion-editor-tab";

const paneNoteOptions = (notes: readonly Note[]): Array<{ label: string; value: string }> =>
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
    onDropTab?: (
        tab: EditorTabDrag,
        side: EditorDropSide,
        copy: boolean,
        paneId?: string,
        beforeNoteId?: string,
    ) => void;
    onCloseTab?: (paneId: string, noteId: string) => void;
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
    onDropTab,
    onCloseTab,
}: EditorPanesProps): JSX.Element {
    const containerRef = useRef<HTMLElement>(null);
    const groupRefs = useRef(new Map<string, GroupImperativeHandle>());
    const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
    const options = paneNoteOptions(notes.some((note) => note.id === currentNote.id) ? notes : [...notes, currentNote]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const updateOrientation = (): void => {
            setOrientation(
                container.getBoundingClientRect().width < state.panes.length * 320 ? "vertical" : "horizontal",
            );
        };
        const observer = new ResizeObserver(updateOrientation);
        updateOrientation();
        observer.observe(container);
        return () => observer.disconnect();
    }, [state.panes.length]);

    const resetLayout = (): void => {
        for (const group of groupRefs.current.values()) {
            const ids = Object.keys(group.getLayout());
            group.setLayout(Object.fromEntries(ids.map((id) => [id, 100 / ids.length])));
        }
    };

    const renderLayout = (layout: EditorLayout, count: number): JSX.Element => {
        if (layout.type === "pane") {
            const index = state.panes.findIndex((pane) => pane.id === layout.id);
            const pane = state.panes[index]!;
            const panel = (
                <PaneContent
                    key={pane.id}
                    pane={pane}
                    index={index}
                    note={getPaneNote(pane, notes, currentNote)}
                    options={options}
                    active={pane.id === state.activePaneId}
                    editorMode={editorMode}
                    rawEditorVimMode={rawEditorVimMode}
                    paneCount={state.panes.length}
                    siblingCount={count}
                    notes={notes}
                    onDropTab={onDropTab}
                    onCloseTab={onCloseTab}
                    canAdd={canAdd}
                    onActivate={onActivate}
                    onSelectNote={onSelectNote}
                    onAdd={onAdd}
                    onRemove={onRemove}
                    onExit={onExit}
                    onResetLayout={resetLayout}
                />
            );
            return panel;
        }
        return (
            <Group
                key={layout.id}
                groupRef={(handle) => {
                    if (handle) groupRefs.current.set(layout.id, handle);
                    else groupRefs.current.delete(layout.id);
                }}
                orientation={layout.orientation}
                className="h-full min-h-0 min-w-0 flex-1 overflow-hidden"
            >
                {layout.children.flatMap((child, index) => {
                    const content =
                        child.type === "pane" ? (
                            renderLayout(child, layout.children.length)
                        ) : (
                            <Panel
                                key={child.id}
                                id={child.id}
                                defaultSize={`${100 / layout.children.length}%`}
                                minSize="10%"
                                className="min-h-0 min-w-0 overflow-hidden"
                            >
                                {renderLayout(child, child.children.length)}
                            </Panel>
                        );
                    return index
                        ? [
                              <Separator
                                  key={`${child.id}:separator`}
                                  aria-label={`Resize editor groups ${index} and ${index + 1}`}
                                  className="writeme-editor-group-separator"
                                  onDoubleClick={resetLayout}
                              />,
                              content,
                          ]
                        : [content];
                })}
            </Group>
        );
    };
    const layout: EditorLayout = state.layout ?? {
        type: "split",
        id: "root",
        orientation,
        children: state.panes.map((pane) => ({ type: "pane", id: pane.id })),
    };
    return (
        <section ref={containerRef} aria-label="Editor groups" className="writeme-editor-panes">
            {layout.type === "pane" ? (
                <Group orientation="horizontal" className="min-h-0 flex-1">
                    {renderLayout(layout, 1)}
                </Group>
            ) : (
                renderLayout(layout, layout.children.length)
            )}
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
    paneCount: number;
    siblingCount: number;
    notes: readonly Note[];
    onDropTab: EditorPanesProps["onDropTab"];
    onCloseTab: EditorPanesProps["onCloseTab"];
    canAdd: boolean;
    onActivate: (paneId: string) => void;
    onSelectNote: (paneId: string, noteId: string) => void;
    onAdd: () => void;
    onRemove: (paneId: string) => void;
    onExit: () => void;
    onResetLayout: () => void;
};

function PaneContent({
    pane,
    index,
    note,
    options,
    active,
    editorMode,
    rawEditorVimMode,
    paneCount,
    siblingCount,
    notes,
    onDropTab,
    onCloseTab,
    canAdd,
    onActivate,
    onSelectNote,
    onAdd,
    onRemove,
    onExit,
    onResetLayout,
}: PaneContentProps): JSX.Element {
    const panelRef = useRef<PanelImperativeHandle>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const tabListRef = useMotionTabDrop({ drop: ({ tab, copy }) => onDropTab?.(tab, "center", copy, pane.id) });
    const resizeGroup = (change: number): void => {
        const panel = panelRef.current;
        if (panel) panel.resize(`${panel.getSize().asPercentage + change}%`);
        setMenuOpen(false);
    };

    return (
        <Panel
            id={pane.id}
            panelRef={panelRef}
            defaultSize={`${100 / siblingCount}%`}
            minSize="10%"
            className="min-h-0 min-w-0 overflow-hidden"
        >
            <section
                aria-label={`Editor group ${index + 1}`}
                data-active={active}
                className="writeme-editor-group"
                onFocusCapture={() => onActivate(pane.id)}
                onPointerDownCapture={() => onActivate(pane.id)}
            >
                <header className="writeme-editor-group-header">
                    <motion.div
                        layoutScroll
                        role="tablist"
                        tabIndex={-1}
                        aria-label={`Tabs in editor group ${index + 1}`}
                        className="writeme-editor-group-tabs"
                        ref={tabListRef}
                        data-editor-tab-drop-target
                    >
                        {(pane.noteIds ?? [pane.noteId]).map((id) => {
                            const tabNote = id === note.id ? note : notes.find((item) => item.id === id);
                            if (!tabNote) return null;
                            return (
                                <MotionEditorTab
                                    key={id}
                                    className="relative flex shrink-0 items-center"
                                    tab={{ noteId: id, paneId: pane.id }}
                                    title={tabNote.title}
                                    onDropTab={({ tab, x, copy }, rect) => {
                                        const ids = pane.noteIds ?? [pane.noteId];
                                        const beforeId =
                                            x <= rect.left + rect.width / 2 ? id : ids[ids.indexOf(id) + 1];
                                        onDropTab?.(tab, "center", copy, pane.id, beforeId);
                                    }}
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={id === pane.noteId}
                                        tabIndex={id === pane.noteId ? 0 : -1}
                                        className="writeme-editor-group-note-tab"
                                        draggable={false}
                                        onClick={() => onSelectNote(pane.id, id)}
                                        onKeyDown={(event) => {
                                            const ids = pane.noteIds ?? [pane.noteId];
                                            const current = ids.indexOf(id);
                                            const next =
                                                event.key === "ArrowRight"
                                                    ? ids[(current + 1) % ids.length]
                                                    : event.key === "ArrowLeft"
                                                      ? ids[(current + ids.length - 1) % ids.length]
                                                      : event.key === "Home"
                                                        ? ids[0]
                                                        : event.key === "End"
                                                          ? ids[ids.length - 1]
                                                          : undefined;
                                            if (!next) return;
                                            event.preventDefault();
                                            onSelectNote(pane.id, next);
                                            const buttons = event.currentTarget
                                                .closest('[role="tablist"]')
                                                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                                            buttons?.[ids.indexOf(next)]?.focus();
                                        }}
                                    >
                                        <FileTextIcon size={16} aria-hidden="true" />
                                        {tabNote.title}
                                    </button>
                                    <button
                                        type="button"
                                        className="writeme-editor-group-action"
                                        aria-label={`Close ${tabNote.title} in group ${index + 1}`}
                                        onClick={() => onCloseTab?.(pane.id, id)}
                                    >
                                        <XIcon size={14} aria-hidden="true" />
                                    </button>
                                </MotionEditorTab>
                            );
                        })}
                    </motion.div>
                    <div className="writeme-editor-group-tab" title={note.filePath ?? note.title}>
                        <FileTextIcon aria-hidden="true" size={16} className="shrink-0 text-foreground" />
                        <Select
                            hiddenLabel
                            size="small"
                            aria-label={`Select note for pane ${index + 1}`}
                            title={`Select note for pane ${index + 1}`}
                            container="writeme-editor-group-picker"
                            labelClassName="writeme-editor-group-picker-control"
                            className="writeme-editor-group-select"
                            options={options}
                            value={note.id}
                            onChange={(event) => onSelectNote(pane.id, event.target.value)}
                        />
                        <Button
                            type="button"
                            size="tiny"
                            theme="ghost-muted"
                            className="writeme-editor-group-action"
                            disabled={paneCount <= 1}
                            aria-label={`Close pane ${index + 1}`}
                            title={paneCount > 1 ? "Close editor group" : "At least one editor must remain open"}
                            onClick={() => onRemove(pane.id)}
                        >
                            <XIcon aria-hidden="true" size={16} />
                        </Button>
                    </div>
                    <div className="writeme-editor-group-controls">
                        <Button
                            type="button"
                            size="tiny"
                            theme="ghost-muted"
                            className="writeme-editor-group-action"
                            disabled={!canAdd}
                            aria-label="Add editor pane"
                            title={canAdd ? "Split editor" : "Maximum editor panes reached"}
                            onClick={onAdd}
                        >
                            <ColumnsIcon aria-hidden="true" size={16} />
                        </Button>
                        <Dropdown
                            open={menuOpen}
                            onChange={setMenuOpen}
                            aria-label={`Editor group ${index + 1} actions`}
                            buttonProps={{
                                className: "writeme-editor-group-action",
                                "aria-label": `Editor group ${index + 1} actions`,
                                title: "Editor group actions",
                            }}
                            trigger={<DotsThreeIcon aria-hidden="true" size={18} />}
                        >
                            <div className="flex min-w-48 flex-col gap-1">
                                <Button
                                    theme="ghost-muted"
                                    size="small"
                                    disabled={paneCount <= 1}
                                    onClick={() => resizeGroup(10)}
                                >
                                    Grow editor group
                                </Button>
                                <Button
                                    theme="ghost-muted"
                                    size="small"
                                    disabled={paneCount <= 1}
                                    onClick={() => resizeGroup(-10)}
                                >
                                    Shrink editor group
                                </Button>
                                <Button
                                    theme="ghost-muted"
                                    size="small"
                                    onClick={() => {
                                        onResetLayout();
                                        setMenuOpen(false);
                                    }}
                                >
                                    Equal group sizes
                                </Button>
                                <Button theme="ghost-muted" size="small" onClick={onExit}>
                                    Single editor
                                </Button>
                            </div>
                        </Dropdown>
                    </div>
                </header>
                <EditorDropTarget onDropTab={(tab, side, copy) => onDropTab?.(tab, side, copy, pane.id)}>
                    <div className="writeme-editor-group-scroll-container">
                        <Editor
                            id={pane.id}
                            note={note}
                            content={note.content || ""}
                            mode={editorMode}
                            rawEditorVimMode={rawEditorVimMode}
                            active={active}
                        />
                    </div>
                </EditorDropTarget>
            </section>
        </Panel>
    );
}
