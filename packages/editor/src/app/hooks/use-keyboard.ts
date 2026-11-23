import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

export type KeyboardState = { open: boolean; height: number };

export const KEYBOARD_CLOSED: KeyboardState = { open: false, height: 0 };

/** Browser chrome (URL bars, tab strips) can shave ~100px off the visual viewport; a keyboard takes far more. */
export const KEYBOARD_MIN_HEIGHT = 120;

type ViewportLike = { height: number; offsetTop: number };

/** Web fallback: the visual viewport shrinks while the layout viewport stays put when a keyboard opens. */
export function keyboardFromViewport(layoutHeight: number, viewport: ViewportLike): KeyboardState {
    const height = Math.round(layoutHeight - viewport.height - viewport.offsetTop);
    return height > KEYBOARD_MIN_HEIGHT ? { open: true, height } : KEYBOARD_CLOSED;
}

/**
 * Tracks the software keyboard. On a Capacitor device the native plugin reports it (the web view itself is
 * resized, so `visualViewport` would see nothing); in a browser it is derived from `visualViewport`.
 */
export function useKeyboard(): KeyboardState {
    const [state, setState] = useState<KeyboardState>(KEYBOARD_CLOSED);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            let disposed = false;
            const handles: Array<{ remove: () => Promise<void> }> = [];
            void import("@capacitor/keyboard")
                .then(async ({ Keyboard }) => {
                    if (Capacitor.getPlatform() === "ios") {
                        // The system "previous / next / done" strip would sit between the keyboard and our toolbar.
                        await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined);
                    }
                    const show = await Keyboard.addListener("keyboardWillShow", (info) =>
                        setState({ open: true, height: Math.round(info.keyboardHeight) }),
                    );
                    const hide = await Keyboard.addListener("keyboardWillHide", () => setState(KEYBOARD_CLOSED));
                    if (disposed) {
                        void show.remove();
                        void hide.remove();
                    } else {handles.push(show, hide);}
                })
                .catch((error: unknown) => console.error("Could not observe the keyboard:", error));
            return () => {
                disposed = true;
                for (const handle of handles) {void handle.remove();}
            };
        }

        const viewport = typeof window === "undefined" ? null : window.visualViewport;
        if (!viewport) {return;}
        const update = (): void => setState(keyboardFromViewport(window.innerHeight, viewport));
        viewport.addEventListener("resize", update);
        viewport.addEventListener("scroll", update);
        return () => {
            viewport.removeEventListener("resize", update);
            viewport.removeEventListener("scroll", update);
        };
    }, []);

    return state;
}
