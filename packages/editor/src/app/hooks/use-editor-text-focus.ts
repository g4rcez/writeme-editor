import { useEffect, useState } from "react";

export const EDITABLE_SELECTOR = '.ProseMirror[contenteditable="true"]';

const isEditable = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null;

/**
 * True while focus is inside a rich-text editor. `focusout` reports where focus is going via `relatedTarget`,
 * so moving between toolbar buttons and the editor never flickers the state.
 */
export function useEditorTextFocus(): boolean {
    const [focused, setFocused] = useState(() => typeof document !== "undefined" && isEditable(document.activeElement));

    useEffect(() => {
        const onIn = (event: FocusEvent): void => setFocused(isEditable(event.target));
        const onOut = (event: FocusEvent): void => setFocused(isEditable(event.relatedTarget));
        document.addEventListener("focusin", onIn);
        document.addEventListener("focusout", onOut);
        return () => {
            document.removeEventListener("focusin", onIn);
            document.removeEventListener("focusout", onOut);
        };
    }, []);

    return focused;
}
