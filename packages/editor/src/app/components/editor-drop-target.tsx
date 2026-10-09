import { motion, useReducedMotion } from "motion/react";
import { useState, type JSX, type PropsWithChildren } from "react";
import { getEditorDropSide, type EditorDropSide, type EditorTabDrag } from "@/lib/editor-tab-drag";
import { useMotionTabDrop } from "../hooks/use-motion-tab-drop";

type Props = PropsWithChildren<{
    onDropTab: (tab: EditorTabDrag, side: EditorDropSide, copy: boolean) => void;
}>;

export function EditorDropTarget({ children, onDropTab }: Props): JSX.Element {
    const [side, setSide] = useState<EditorDropSide | null>(null);
    const reducedMotion = useReducedMotion();
    const ref = useMotionTabDrop({
        drop: (drop, rect) => onDropTab(drop.tab, getEditorDropSide(rect, drop.x, drop.y), drop.copy),
        preview: (drop, rect) => setSide(drop ? getEditorDropSide(rect, drop.x, drop.y) : null),
    });
    return (
        <div ref={ref} data-editor-tab-drop-target className="writeme-editor-drop-target">
            {children}
            {side && (
                <motion.div
                    aria-label={`Drop tab ${side}`}
                    className="writeme-editor-drop-preview"
                    data-side={side}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reducedMotion ? 0 : 0.12 }}
                />
            )}
        </div>
    );
}
