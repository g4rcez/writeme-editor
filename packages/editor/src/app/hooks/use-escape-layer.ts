import { useEffect, useEffectEvent } from "react";

export const EscapeLevel = { window: 0, sidebar: 10, panel: 20, popover: 30, action: 40 } as const;

type EscapeLayer = { level: number; close: () => void };
const layers = new Set<EscapeLayer>();
const candidates = new WeakMap<KeyboardEvent, EscapeLayer>();
const overlaySelector =
    'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-escape-layer]';

function captureEscape(event: KeyboardEvent): void {
    if (event.key !== "Escape" || event.repeat || event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        const windowLayer = Array.from(layers).find((layer) => layer.level === EscapeLevel.window);
        if (windowLayer) {
            event.preventDefault();
            event.stopImmediatePropagation();
            windowLayer.close();
            return;
        }
    }
    // Snapshot before a dialog or menu removes itself during this key press.
    if (
        Array.from(document.querySelectorAll<HTMLElement>(overlaySelector)).some(
            (element) =>
                !element.hasAttribute("data-escape-managed") &&
                !element.closest('[hidden], [aria-hidden="true"], [data-closed]') &&
                getComputedStyle(element).visibility === "visible" &&
                element.getClientRects().length > 0,
        )
    )
        return;
    let candidate: EscapeLayer | undefined;
    for (const layer of layers) {
        if (!candidate || layer.level >= candidate.level) candidate = layer;
    }
    if (candidate) candidates.set(event, candidate);
}

function dismissEscape(event: KeyboardEvent): void {
    const candidate = candidates.get(event);
    if (!candidate) return;
    candidates.delete(event);
    // Let editor keymaps and other window listeners consume Escape first.
    setTimeout(() => {
        if (event.defaultPrevented || !layers.has(candidate)) return;
        candidate.close();
    }, 0);
}

export function useEscapeLayer(level: number, enabled: boolean, onClose: () => void): void {
    const close = useEffectEvent(onClose);
    useEffect(() => {
        if (!enabled) return;
        const layer = { level, close: () => close() };
        if (layers.size === 0) {
            window.addEventListener("keydown", captureEscape, true);
            window.addEventListener("keydown", dismissEscape);
        }
        layers.add(layer);
        return () => {
            layers.delete(layer);
            if (layers.size === 0) {
                window.removeEventListener("keydown", captureEscape, true);
                window.removeEventListener("keydown", dismissEscape);
            }
        };
    }, [enabled, level]);
}
