import { uuid } from "@g4rcez/components";
import { useCallback, useState } from "react";
import { NoteType, type Note } from "@/store/note";

export type EditorPane = Readonly<{
    id: string;
    noteId: string;
}>;

export type EditorPaneState = Readonly<{
    rootNoteId: string;
    activePaneId: string;
    panes: readonly EditorPane[];
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

export function useEditorPanes(noteId: string | null, notes: readonly Note[]) {
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
                pane.id === paneId ? { ...pane, noteId: selectedNoteId } : pane,
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
        commit({ ...stateForNote, panes: [...stateForNote.panes, pane], activePaneId: pane.id });
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
            commit({ ...stateForNote, panes, activePaneId });
        },
        [commit, stateForNote],
    );

    return {
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
