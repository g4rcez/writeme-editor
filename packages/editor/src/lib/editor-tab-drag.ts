export const OPEN_EDITOR_NOTE_EVENT = "writeme:open-editor-note";
export const ACTIVE_EDITOR_NOTE_EVENT = "writeme:active-editor-note";

export type EditorTabDrag = { tabId?: string; noteId: string; paneId?: string };
export type EditorDropSide = "left" | "right" | "top" | "bottom" | "center";
export type EditorLayout =
    | { type: "pane"; id: string }
    | { type: "split"; id: string; orientation: "horizontal" | "vertical"; children: EditorLayout[] };

export function getEditorDropSide(rect: DOMRect, x: number, y: number): EditorDropSide {
    const distances = [
        { side: "left", distance: (x - rect.left) / rect.width },
        { side: "right", distance: (rect.right - x) / rect.width },
        { side: "top", distance: (y - rect.top) / rect.height },
        { side: "bottom", distance: (rect.bottom - y) / rect.height },
    ] satisfies Array<{ side: EditorDropSide; distance: number }>;
    distances.sort((a, b) => a.distance - b.distance);
    const nearest = distances[0];
    return nearest && nearest.distance < 0.25 ? nearest.side : "center";
}

export function pruneEditorLayout(layout: EditorLayout, ids: Set<string>): EditorLayout | null {
    if (layout.type === "pane") return ids.has(layout.id) ? layout : null;
    const children = layout.children.flatMap((child) => {
        const next = pruneEditorLayout(child, ids);
        return next ? [next] : [];
    });
    return children.length === 1 ? children[0]! : children.length ? { ...layout, children } : null;
}

export function splitEditorLayout(
    layout: EditorLayout,
    targetId: string,
    paneId: string,
    side: EditorDropSide,
): EditorLayout {
    if (layout.type === "split")
        return {
            ...layout,
            children: layout.children.map((child) => splitEditorLayout(child, targetId, paneId, side)),
        };
    if (layout.id !== targetId) return layout;
    const added: EditorLayout = { type: "pane", id: paneId };
    return {
        type: "split",
        id: paneId + ":split",
        orientation: side === "top" || side === "bottom" ? "vertical" : "horizontal",
        children: side === "left" || side === "top" ? [added, layout] : [layout, added],
    };
}
