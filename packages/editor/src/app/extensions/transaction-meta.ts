// Relocation cancels modal editing ranges as well as moving the ProseMirror selection.
export const SELECTION_RELOCATED_META = "writeme:selection-relocated";

// Chunked replacements are one logical document update, not authored outline edits.
export const CONTENT_LOAD_META = "writeme:content-load";
export type ContentLoadPhase = "start" | "finish" | "abort";
