import { useCallback, useLayoutEffect, useRef } from "react";
import type { EditorTabDrag } from "@/lib/editor-tab-drag";

export type MotionTabDrop = { tab: EditorTabDrag; x: number; y: number; copy: boolean };
type DropTarget = {
    drop: (drop: MotionTabDrop, rect: DOMRect) => void;
    preview?: (drop: MotionTabDrop | null, rect: DOMRect) => void;
};

const targets = new Map<HTMLElement, DropTarget>();
let active: { tab: EditorTabDrag; source: HTMLElement | null; cancel: () => void } | null = null;
let hovered: HTMLElement | null = null;

function clearPreview(): void {
    if (hovered) targets.get(hovered)?.preview?.(null, hovered.getBoundingClientRect());
    hovered = null;
}

export function startMotionTabDrag(tab: EditorTabDrag, source: HTMLElement | null, cancel: () => void): void {
    cancelMotionTabDrag();
    active = { tab, source, cancel };
}

export function cancelMotionTabDrag(): void {
    const canceled = active;
    active = null;
    clearPreview();
    canceled?.cancel();
}

export function updateMotionTabDrag(x: number, y: number, copy: boolean): void {
    if (!active) return;
    const hit = document.elementFromPoint(x, y);
    const sourceRect = active.source?.getBoundingClientRect();
    const overSource =
        sourceRect && x >= sourceRect.left && x <= sourceRect.right && y >= sourceRect.top && y <= sourceRect.bottom;
    const element = overSource ? active.source : (hit?.closest<HTMLElement>("[data-editor-tab-drop-target]") ?? null);
    if (element !== hovered) clearPreview();
    hovered = element;
    if (element) targets.get(element)?.preview?.({ tab: active.tab, x, y, copy }, element.getBoundingClientRect());
    const list = hit?.closest<HTMLElement>(".writeme-tabs-bar-list, .writeme-editor-group-tabs");
    if (list) {
        const rect = list.getBoundingClientRect();
        if (x < rect.left + 24) list.scrollLeft -= 16;
        else if (x > rect.right - 24) list.scrollLeft += 16;
    }
}

export function finishMotionTabDrag(x: number, y: number, copy: boolean): void {
    if (!active) return;
    updateMotionTabDrag(x, y, copy);
    const tab = active.tab;
    const element = hovered;
    active = null;
    clearPreview();
    if (element) targets.get(element)?.drop({ tab, x, y, copy }, element.getBoundingClientRect());
}

export function useMotionTabDrop(target: DropTarget): (element: HTMLDivElement | null) => void {
    const latest = useRef(target);
    useLayoutEffect(() => {
        latest.current = target;
    }, [target]);
    const previous = useRef<HTMLDivElement | null>(null);
    return useCallback((element: HTMLDivElement | null): void => {
        if (previous.current) targets.delete(previous.current);
        previous.current = element;
        if (element)
            targets.set(element, {
                drop: (drop, rect) => latest.current.drop(drop, rect),
                preview: (drop, rect) => latest.current.preview?.(drop, rect),
            });
    }, []);
}
