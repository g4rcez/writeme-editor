import type { Editor } from "@tiptap/core";

export type EditorSearchState = {
    searchTerm: string;
    replaceTerm: string;
    resultsCount: number;
    resultIndex: number;
    caseSensitive: boolean;
};

export type EditorSearchHandle = {
    getState: () => EditorSearchState;
    getContent: () => string;
    setSearchTerm: (searchTerm: string) => void;
    setReplaceTerm: (replaceTerm: string) => void;
    setCaseSensitive: (caseSensitive: boolean) => void;
    nextSearchResult: () => void;
    previousSearchResult: () => void;
    replace: (replaceTerm: string) => void;
    replaceAll: (replaceTerm: string) => void;
    focus: () => void;
    subscribe: (listener: () => void) => () => void;
};

export type EditorActionHandle = {
    addFrontmatter: () => void;
};

export const editorGlobalRef: { current: Editor | null } = { current: null };
export const editorActionsGlobalRef: { current: EditorActionHandle | null } = { current: null };
export const editorSearchGlobalRef: { current: EditorSearchHandle | null } = { current: null };

type RegisteredEditor = {
    activate: () => void;
};

const registeredEditors: RegisteredEditor[] = [];
let activeEditor: RegisteredEditor | null = null;

export function registerEditorActivation(activate: () => void): {
    activate: () => void;
    unregister: () => void;
} {
    const registeredEditor: RegisteredEditor = { activate };
    registeredEditors.push(registeredEditor);

    return {
        activate: () => {
            if (!registeredEditors.includes(registeredEditor)) return;
            activeEditor = registeredEditor;
            registeredEditor.activate();
        },
        unregister: () => {
            const index = registeredEditors.indexOf(registeredEditor);
            if (index === -1) return;
            registeredEditors.splice(index, 1);
            if (activeEditor !== registeredEditor) return;

            activeEditor = registeredEditors.at(-1) ?? null;
            activeEditor?.activate();
        },
    };
}

export function setEditorActionsGlobalRef(handle: EditorActionHandle | null): void {
    editorActionsGlobalRef.current = handle;
}

const editorSearchListeners = new Set<() => void>();

export function setEditorSearchGlobalRef(handle: EditorSearchHandle | null): void {
    editorSearchGlobalRef.current = handle;
    editorSearchListeners.forEach((listener) => listener());
}

export function subscribeEditorSearchGlobalRef(listener: () => void): () => void {
    editorSearchListeners.add(listener);
    return () => editorSearchListeners.delete(listener);
}
