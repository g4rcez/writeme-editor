import { uuid } from "@g4rcez/components";
import { useCallback, useState } from "react";
import {
    pruneEditorLayout,
    splitEditorLayout,
    type EditorLayout,
    type EditorTabDrag,
    type EditorDropSide,
} from "@/lib/editor-tab-drag";
import { NoteType, type Note } from "@/store/note";

export type EditorPane = Readonly<{
    id: string;
    noteId: string;
    noteIds?: readonly string[];
}>;

export type EditorPaneState = Readonly<{
    rootNoteId: string;
    activePaneId: string;
    panes: readonly EditorPane[];
    layout?: EditorLayout;
}>;

const paneStates = new Map<string, EditorPaneState>();
const MAX_EDITOR_PANES = 4;

function isPaneNote(note: Note): boolean {
    return note.deletedAt === null && note.noteType !== NoteType.json && note.noteType !== NoteType.excalidraw;
}

function createPane(noteId: string): EditorPane {
    return { id: uuid(), noteId };
}

function getInitialState(noteId: string, notes: readonly Note[]): EditorPaneState {
    const eligibleNotes = notes.filter(isPaneNote);
    const secondNote = eligibleNotes.find((note) => note.id !== noteId)?.id ?? noteId;
    const firstPane = createPane(noteId);
    const secondPane = createPane(secondNote);
    return {
        rootNoteId: noteId,
        activePaneId: firstPane.id,
        panes: [firstPane, secondPane],
    };
}

export function useEditorPanes(noteId: string | null, notes: readonly Note[], openNoteIds: readonly string[] = []) {
    const [state, setState] = useState<EditorPaneState | null>(() =>
        noteId ? (paneStates.get(noteId) ?? null) : null,
    );
    const stateForNote =
        noteId && state?.rootNoteId === noteId ? state : noteId ? (paneStates.get(noteId) ?? null) : null;

    const commit = useCallback(
        (next: EditorPaneState | null): void => {
            if (!noteId) return;
            if (next) paneStates.set(noteId, next);
            else paneStates.delete(noteId);
            setState(next);
        },
        [noteId],
    );

    const enter = useCallback((): void => {
        if (!noteId || stateForNote) return;
        commit(getInitialState(noteId, notes));
    }, [commit, noteId, notes, stateForNote]);

    const exit = useCallback((): void => {
        commit(null);
    }, [commit]);

    const activate = useCallback(
        (paneId: string): void => {
            if (
                !stateForNote ||
                !stateForNote.panes.some((pane) => pane.id === paneId) ||
                stateForNote.activePaneId === paneId
            )
                return;
            commit({ ...stateForNote, activePaneId: paneId });
        },
        [commit, stateForNote],
    );

    const selectNote = useCallback(
        (paneId: string, selectedNoteId: string): void => {
            if (!stateForNote) return;
            const panes = stateForNote.panes.map((pane) =>
                pane.id === paneId
                    ? {
                          ...pane,
                          noteId: selectedNoteId,
                          noteIds: [...new Set([...(pane.noteIds ?? [pane.noteId]), selectedNoteId])],
                      }
                    : pane,
            );
            if (panes.every((pane, index) => pane.noteId === stateForNote.panes[index]?.noteId)) return;
            commit({ ...stateForNote, panes, activePaneId: paneId });
        },
        [commit, stateForNote],
    );

    const add = useCallback((): void => {
        if (!stateForNote || stateForNote.panes.length >= MAX_EDITOR_PANES) return;
        const usedNoteIds = new Set(stateForNote.panes.map((pane) => pane.noteId));
        const nextNoteId =
            notes.find((note) => isPaneNote(note) && !usedNoteIds.has(note.id))?.id ?? stateForNote.rootNoteId;
        const pane = createPane(nextNoteId);
        const layout = stateForNote.layout;
        commit({
            ...stateForNote,
            panes: [...stateForNote.panes, pane],
            activePaneId: pane.id,
            layout: layout ? splitEditorLayout(layout, stateForNote.activePaneId, pane.id, "right") : undefined,
        });
    }, [commit, notes, stateForNote]);

    const remove = useCallback(
        (paneId: string): void => {
            if (!stateForNote || stateForNote.panes.length <= 1) return;
            const index = stateForNote.panes.findIndex((pane) => pane.id === paneId);
            if (index < 0) return;
            const panes = stateForNote.panes.filter((pane) => pane.id !== paneId);
            const replacementPane = panes[Math.min(index, panes.length - 1)];
            if (!replacementPane) return;
            const activePaneId = stateForNote.activePaneId === paneId ? replacementPane.id : stateForNote.activePaneId;
            commit({
                ...stateForNote,
                panes,
                activePaneId,
                layout: stateForNote.layout
                    ? (pruneEditorLayout(stateForNote.layout, new Set(panes.map((pane) => pane.id))) ?? undefined)
                    : undefined,
            });
        },
        [commit, stateForNote],
    );

    const dropTab = (
        tab: EditorTabDrag,
        side: EditorDropSide,
        copy: boolean,
        targetPaneId?: string,
        beforeNoteId?: string,
    ): void => {
        if (!noteId || !notes.some((note) => note.id === tab.noteId && isPaneNote(note))) return;
        const initialIds = [...new Set([noteId, ...openNoteIds])].filter(
            (id) =>
                notes.some((note) => note.id === id && isPaneNote(note)) &&
                (copy || side === "center" || id !== tab.noteId),
        );
        const first = { ...createPane(initialIds[0] ?? noteId), noteIds: initialIds.length ? initialIds : [noteId] };
        const current: EditorPaneState = stateForNote ?? { rootNoteId: noteId, activePaneId: first.id, panes: [first] };
        const targetId = targetPaneId ?? current.activePaneId;
        const target = current.panes.find((pane) => pane.id === targetId);
        if (!target) return;
        const source = current.panes.find((pane) =>
            tab.paneId ? pane.id === tab.paneId : (pane.noteIds ?? [pane.noteId]).includes(tab.noteId),
        );
        const removesSource =
            source && source.id !== targetId && !copy && (source.noteIds ?? [source.noteId]).length === 1;
        if (side !== "center" && current.panes.length >= MAX_EDITOR_PANES && !removesSource) return;
        if (side === "center" && source?.id === targetId && beforeNoteId === tab.noteId) return;
        if (side !== "center" && source?.id === targetId && (source.noteIds ?? [source.noteId]).length === 1 && !copy)
            return;
        let panes = current.panes.map((pane) => ({ ...pane, noteIds: [...(pane.noteIds ?? [pane.noteId])] }));
        if (source && !copy) {
            panes = panes.map((pane) => {
                if (pane.id !== source.id) return pane;
                const noteIds = pane.noteIds.filter((id) => id !== tab.noteId);
                return {
                    ...pane,
                    noteIds,
                    noteId: pane.noteId === tab.noteId ? (noteIds[0] ?? pane.noteId) : pane.noteId,
                };
            });
        }
        let layout: EditorLayout = current.layout ?? {
            type: "split",
            id: "root",
            orientation: "horizontal",
            children: current.panes.map((pane) => ({ type: "pane", id: pane.id })),
        };
        let activePaneId = targetId;
        if (side === "center") {
            panes = panes.map((pane) => {
                if (pane.id !== targetId) return pane;
                const noteIds = pane.noteIds.filter((id) => id !== tab.noteId);
                const index = beforeNoteId ? noteIds.indexOf(beforeNoteId) : -1;
                noteIds.splice(index < 0 ? noteIds.length : index, 0, tab.noteId);
                return { ...pane, noteIds, noteId: tab.noteId };
            });
        } else {
            const added = { ...createPane(tab.noteId), noteIds: [tab.noteId] };
            panes.push(added);
            activePaneId = added.id;
            layout = splitEditorLayout(layout, targetId, added.id, side);
        }
        panes = panes.filter((pane) => pane.noteIds.length > 0);
        layout = pruneEditorLayout(layout, new Set(panes.map((pane) => pane.id))) ?? layout;
        commit({ ...current, panes, layout, activePaneId });
    };

    const closeTab = (paneId: string, selectedNoteId: string): void => {
        if (!stateForNote) return;
        const pane = stateForNote.panes.find((item) => item.id === paneId);
        if (!pane) return;
        const noteIds = (pane.noteIds ?? [pane.noteId]).filter((id) => id !== selectedNoteId);
        if (!noteIds.length) {
            if (stateForNote.panes.length === 1) exit();
            else remove(paneId);
            return;
        }
        commit({
            ...stateForNote,
            panes: stateForNote.panes.map((item) =>
                item.id === paneId
                    ? { ...item, noteIds, noteId: item.noteId === selectedNoteId ? noteIds[0]! : item.noteId }
                    : item,
            ),
        });
    };

    return {
        dropTab,
        closeTab,
        state: stateForNote,
        canAdd: Boolean(stateForNote && stateForNote.panes.length < MAX_EDITOR_PANES),
        enter,
        exit,
        activate,
        selectNote,
        add,
        remove,
    };
}

export function clearEditorPaneState(): void {
    paneStates.clear();
}
