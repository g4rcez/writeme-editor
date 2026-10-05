export type WritingCategory = "spelling" | "grammar" | "clarity" | "enhancement";

export type WritingScope = "note" | "selection" | "paragraph" | "line";

export type WritingSelectionRange = { from: number; to: number };

export type WritingSegment = {
    id: string;
    text: string;
    from: number;
    to: number;
};

export type WritingSnapshot = {
    revision: number;
    segments: WritingSegment[];
};

export type WritingSuggestion = {
    id: string;
    segmentId: string;
    from: number;
    to: number;
    original: string;
    replacement: string;
    category: WritingCategory;
    explanation: string;
};

export type WritingEditorAdapter = {
    snapshot(scope: WritingScope, selection?: WritingSelectionRange): WritingSnapshot;
    show(suggestions: WritingSuggestion[], snapshot: WritingSnapshot): void;
    clear(): void;
    reveal(id: string): void;
    focus(): void;
    accept(id: string): boolean;
    dismiss(id: string): void;
    getSuggestions(): readonly WritingSuggestion[];
    getActiveSuggestionId(): string | null;
    getStatusMessage(): string | null;
    isEditable(): boolean;
    subscribe(listener: () => void): () => void;
    subscribeDocument(listener: () => void): () => void;
    subscribeSelection(listener: () => void): () => void;
    dispose(): void;
};
