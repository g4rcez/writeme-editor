import { useEffect, useRef, useState, type PointerEvent } from "react";

type Point = { x: number; y: number };
type Gesture = {
    pointerId: number;
    start: Point;
    last: Point;
    canTurn: boolean;
};

export function usePdfPageGestures({
    enabled,
    pageIndex,
    zoom,
    onTurn,
    onZoom,
}: {
    enabled: boolean;
    pageIndex: number;
    zoom: number;
    onTurn: (direction: number) => void;
    onZoom: (zoom: number) => void;
}): {
    offset: number;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
} {
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<Gesture | null>(null);
    const [drag, setDrag] = useState({ enabled, pageIndex, offset: 0 });
    if (drag.enabled !== enabled || drag.pageIndex !== pageIndex) setDrag({ enabled, pageIndex, offset: 0 });

    function setOffset(offset: number): void {
        setDrag({ enabled, pageIndex, offset });
    }

    useEffect(() => {
        pointers.current.clear();
        gesture.current = null;
    }, [enabled, pageIndex]);

    function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
        if (!enabled || event.button !== 0 || event.pointerType === "pen") return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest(".wm-sticky-link, .wm-pdf-loading, button, a, input")) return;
        if (target.closest(".wm-pdf-text-layer span")) return;
        const point = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, point);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointers.current.size > 1) {
            gesture.current = null;
            setOffset(0);
            return;
        }
        gesture.current = { pointerId: event.pointerId, start: point, last: point, canTurn: zoom <= 1 };
    }

    function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
        if (!enabled || !pointers.current.has(event.pointerId)) return;
        const before = [...pointers.current.values()];
        const point = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, point);
        const after = [...pointers.current.values()];
        if (before.length === 2 && after.length === 2) {
            const distance = (points: Point[]): number =>
                Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
            const previous = distance(before);
            if (previous > 0) onZoom((zoom * distance(after)) / previous);
            event.preventDefault();
            return;
        }
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const dx = point.x - active.start.x;
        const dy = point.y - active.start.y;
        if (active.canTurn) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                event.preventDefault();
                window.getSelection()?.removeAllRanges();
                const limit = event.currentTarget.clientWidth * 0.35;
                setOffset(Math.max(-limit, Math.min(limit, dx)));
            } else setOffset(0);
        } else {
            event.preventDefault();
            event.currentTarget.scrollLeft -= point.x - active.last.x;
            event.currentTarget.scrollTop -= point.y - active.last.y;
        }
        active.last = point;
    }

    function finish(event: PointerEvent<HTMLDivElement>, cancelled: boolean): void {
        pointers.current.delete(event.pointerId);
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId) return;
        gesture.current = null;
        setOffset(0);
        if (!enabled || cancelled || !active.canTurn) return;
        const dx = event.clientX - active.start.x;
        const dy = event.clientY - active.start.y;
        const threshold = Math.min(80, event.currentTarget.clientWidth * 0.2);
        if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.5) onTurn(dx < 0 ? 1 : -1);
    }

    return {
        offset: drag.offset,
        onPointerDown,
        onPointerMove,
        onPointerUp: (event) => finish(event, false),
        onPointerCancel: (event) => finish(event, true),
    };
}
