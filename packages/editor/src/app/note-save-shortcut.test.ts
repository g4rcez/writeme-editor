import { afterEach, describe, expect, it, vi } from "vitest";
import { registerNoteSaveShortcut } from "./note-save-shortcut";

afterEach(() => document.body.replaceChildren());

describe("note save shortcut", () => {
    it("saves only the focused pane and prevents the browser save action", () => {
        const first = document.createElement("div");
        first.id = "editor-container-first";
        first.className = "writeme-editor";
        const second = document.createElement("div");
        second.id = "editor-container-second";
        second.className = "writeme-editor";
        const input = document.createElement("textarea");
        second.append(input);
        document.body.append(first, second);
        input.focus();
        const saveFirst = vi.fn();
        const saveSecond = vi.fn();
        const cleanFirst = registerNoteSaveShortcut("first", saveFirst, true);
        const cleanSecond = registerNoteSaveShortcut("second", saveSecond, false);
        for (const modifier of ["ctrlKey", "metaKey"]) {
            const event = new KeyboardEvent("keydown", { key: "s", [modifier]: true, bubbles: true, cancelable: true });
            input.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
        expect(saveFirst).not.toHaveBeenCalled();
        expect(saveSecond).toHaveBeenCalledTimes(2);
        for (const extra of [{ shiftKey: true }, { altKey: true }, { repeat: true }, { isComposing: true }]) {
            input.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, ...extra }));
        }
        expect(saveSecond).toHaveBeenCalledTimes(2);
        cleanFirst();
        cleanSecond();
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
        expect(saveSecond).toHaveBeenCalledTimes(2);
    });
});
