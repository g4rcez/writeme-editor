import { motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type JSX, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import type { EditorTabDrag } from "@/lib/editor-tab-drag";
import {
    cancelMotionTabDrag,
    finishMotionTabDrag,
    startMotionTabDrag,
    updateMotionTabDrag,
    useMotionTabDrop,
    type MotionTabDrop,
} from "../hooks/use-motion-tab-drop";

type Props = PropsWithChildren<{
    tab: EditorTabDrag;
    title: string;
    disabled?: boolean;
    className?: string;
    onDropTab: (drop: MotionTabDrop, rect: DOMRect) => void;
}>;

export function MotionEditorTab({ tab, title, disabled, className, onDropTab, children }: Props): JSX.Element {
    const controls = useDragControls();
    const reducedMotion = useReducedMotion();
    const [dragging, setDragging] = useState(false);
    const [insertion, setInsertion] = useState<"left" | "right" | null>(null);
    const dragged = useRef(false);
    const source = useRef<HTMLDivElement | null>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const targetRef = useMotionTabDrop({
        drop: onDropTab,
        preview: (drop, rect) => setInsertion(drop ? (drop.x < rect.left + rect.width / 2 ? "left" : "right") : null),
    });
    useEffect(() => {
        if (!dragging) return;
        const escape = (event: KeyboardEvent): void => {
            if (event.key === "Escape") cancelMotionTabDrag();
        };
        window.addEventListener("keydown", escape);
        window.addEventListener("blur", cancelMotionTabDrag);
        return () => {
            window.removeEventListener("keydown", escape);
            window.removeEventListener("blur", cancelMotionTabDrag);
            cancelMotionTabDrag();
        };
    }, [dragging]);
    return (
        <>
            <motion.div
                ref={targetRef}
                data-editor-tab-drop-target
                data-tab-drop-position={insertion ?? undefined}
                className={className}
                layout={reducedMotion ? false : "position"}
                transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                drag={!disabled}
                dragControls={controls}
                dragListener={false}
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                style={{ touchAction: "none", pointerEvents: dragging ? "none" : undefined }}
                animate={{ opacity: dragging ? 0.35 : 1 }}
                onPointerDown={(event) => {
                    dragged.current = false;
                    if (
                        disabled ||
                        event.button !== 0 ||
                        (event.target instanceof Element &&
                            event.target.closest('button:not([role="tab"]), input, textarea'))
                    )
                        return;
                    controls.start(event);
                    source.current = event.currentTarget;
                }}
                onClickCapture={(event) => {
                    if (dragged.current && event.detail !== 0) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }}
                onDragStartCapture={(event) => event.preventDefault()}
                onDragStart={(event, info) => {
                    dragged.current = true;
                    x.set(info.point.x + 12);
                    y.set(info.point.y + 12);
                    startMotionTabDrag(tab, source.current, () => {
                        controls.cancel();
                        setDragging(false);
                    });
                    setDragging(true);
                    updateMotionTabDrag(
                        info.point.x,
                        info.point.y,
                        "altKey" in event && (event.altKey || event.ctrlKey),
                    );
                }}
                onDrag={(event, info) => {
                    x.set(info.point.x + 12);
                    y.set(info.point.y + 12);
                    updateMotionTabDrag(
                        info.point.x,
                        info.point.y,
                        "altKey" in event && (event.altKey || event.ctrlKey),
                    );
                }}
                onDragEnd={(event, info) => {
                    if (event.type === "pointercancel" || event.type === "touchcancel") cancelMotionTabDrag();
                    else
                        finishMotionTabDrag(
                            info.point.x,
                            info.point.y,
                            "altKey" in event && (event.altKey || event.ctrlKey),
                        );
                    setDragging(false);
                }}
            >
                {children}
            </motion.div>
            {dragging &&
                createPortal(
                    <motion.div
                        aria-hidden="true"
                        data-motion-tab-ghost
                        className="pointer-events-none fixed left-0 top-0 z-[100] rounded border border-primary bg-card-background px-3 py-2 text-sm text-foreground shadow-lg"
                        style={{ x, y }}
                    >
                        {title}
                    </motion.div>,
                    document.body,
                )}
        </>
    );
}
