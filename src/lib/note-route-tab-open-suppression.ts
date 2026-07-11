const suppressedNoteRouteTabOpens = new Set<string>();

export function suppressNoteRouteTabOpen(noteId: string): void {
    suppressedNoteRouteTabOpens.add(noteId);
}

export function isNoteRouteTabOpenSuppressed(noteId: string): boolean {
    return suppressedNoteRouteTabOpens.has(noteId);
}

export function clearSuppressedNoteRouteTabOpens(): void {
    suppressedNoteRouteTabOpens.clear();
}
