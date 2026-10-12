import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EscapeLevel, useEscapeLayer } from "./use-escape-layer";

function Layer({ level, close }: { level: number; close: () => void }) {
    useEscapeLayer(level, true, close);
    return <input aria-label={`Layer ${level}`} />;
}

async function escape(target: EventTarget = window, init: KeyboardEventInit = {}): Promise<void> {
    await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init }));
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe("Escape layers", () => {
    it("closes one layer per press, highest priority first, then the window", async () => {
        const closeWindow = vi.fn();
        const closePanel = vi.fn();
        const view = render(
            <>
                <Layer level={EscapeLevel.panel} close={closePanel} />
                <Layer level={EscapeLevel.window} close={closeWindow} />
            </>,
        );
        await escape();
        expect(closePanel).toHaveBeenCalledOnce();
        expect(closeWindow).not.toHaveBeenCalled();
        view.rerender(<Layer level={EscapeLevel.window} close={closeWindow} />);
        await escape();
        expect(closeWindow).toHaveBeenCalledOnce();
    });

    it("lets target keymaps consume Escape", async () => {
        const close = vi.fn();
        render(<Layer level={EscapeLevel.window} close={close} />);
        const input = screen.getByRole("textbox");
        input.addEventListener("keydown", (event) => event.preventDefault());
        await escape(input);
        expect(close).not.toHaveBeenCalled();
    });

    it("lets later window listeners consume Escape", async () => {
        const close = vi.fn();
        render(<Layer level={EscapeLevel.window} close={close} />);
        window.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
        await escape();
        expect(close).not.toHaveBeenCalled();
    });

    it("preserves the overlay snapshot even when it is removed without preventing the key", async () => {
        const close = vi.fn();
        render(<Layer level={EscapeLevel.window} close={close} />);
        const dialog = document.createElement("div");
        dialog.setAttribute("role", "dialog");
        vi.spyOn(dialog, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
        document.body.append(dialog);
        window.addEventListener("keydown", () => dialog.remove(), { once: true });
        await escape();
        expect(close).not.toHaveBeenCalled();
        await escape();
        expect(close).toHaveBeenCalledOnce();
    });

    it("ignores repeated keys, composition and non-Escape keys", async () => {
        const close = vi.fn();
        render(<Layer level={EscapeLevel.window} close={close} />);
        await escape(window, { repeat: true });
        await escape(window, { isComposing: true });
        fireEvent.keyDown(window, { key: "Enter" });
        expect(close).not.toHaveBeenCalled();
    });

    it("cancels pending dismissal on unmount", async () => {
        const close = vi.fn();
        const view = render(<Layer level={EscapeLevel.window} close={close} />);
        await act(async () => {
            fireEvent.keyDown(window, { key: "Escape" });
            view.unmount();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(close).not.toHaveBeenCalled();
    });
});
