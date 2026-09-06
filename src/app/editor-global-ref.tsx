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

export const editorGlobalRef: { current: Editor | null } = { current: null };
export const editorSearchGlobalRef: { current: EditorSearchHandle | null } = { current: null };

const editorSearchListeners = new Set<() => void>();

export function setEditorSearchGlobalRef(handle: EditorSearchHandle | null): void {
    editorSearchGlobalRef.current = handle;
    editorSearchListeners.forEach((listener) => listener());
}

export function subscribeEditorSearchGlobalRef(listener: () => void): () => void {
    editorSearchListeners.add(listener);
    return () => editorSearchListeners.delete(listener);
}
