import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    KeyboardClickHints,
    createClickHints,
    getClickHintCode,
    getVisibleClickableElements,
} from "./keyboard-click-hints";

vi.mock("@g4rcez/components", () => ({
    css: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

function mockVisibleBox(element: HTMLElement): void {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        bottom: 56,
        height: 40,
        left: 16,
        right: 116,
        top: 16,
        width: 100,
        x: 16,
        y: 16,
        toJSON: () => ({}),
    } as DOMRect);
}

afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

describe("getClickHintCode", () => {
    it("generates two-letter codes from AA through ZZ", () => {
        expect(getClickHintCode(0)).toBe("AA");
        expect(getClickHintCode(25)).toBe("AZ");
        expect(getClickHintCode(26)).toBe("BA");
        expect(getClickHintCode(675)).toBe("ZZ");
        expect(getClickHintCode(676)).toBeNull();
    });
});

describe("getVisibleClickableElements", () => {
    it("returns visible enabled clickable elements outside the hint overlay", () => {
        const enabled = document.createElement("button");
        enabled.id = "enabled";
        enabled.textContent = "Enabled";

        const disabled = document.createElement("button");
        disabled.disabled = true;
        disabled.id = "disabled";
        disabled.textContent = "Disabled";

        const hidden = document.createElement("a");
        hidden.hidden = true;
        hidden.href = "#";
        hidden.id = "hidden";
        hidden.textContent = "Hidden";

        const overlay = document.createElement("div");
        overlay.dataset.clickHintsOverlay = "";
        const overlayButton = document.createElement("button");
        overlayButton.id = "overlay";
        overlayButton.textContent = "Overlay";
        overlay.append(overlayButton);

        const input = document.createElement("input");
        input.id = "input";

        document.body.append(enabled, disabled, hidden, overlay, input);

        for (const element of [enabled, disabled, hidden, overlayButton, input]) {
            mockVisibleBox(element);
        }

        expect(getVisibleClickableElements().map((element) => element.id)).toEqual(["enabled", "input"]);
    });
});

describe("createClickHints", () => {
    it("assigns generated codes to visible elements", () => {
        const first = document.createElement("button");
        const second = document.createElement("a");
        mockVisibleBox(first);
        mockVisibleBox(second);

        expect(createClickHints([first, second]).map((hint) => hint.code)).toEqual(["AA", "AB"]);
    });
});

describe("KeyboardClickHints", () => {
    it("opens with Ctrl+Slash and clicks the selected element after code plus Enter", async () => {
        const target = document.createElement("button");
        const onClick = vi.fn();
        target.textContent = "Target";
        target.addEventListener("click", onClick);
        mockVisibleBox(target);
        document.body.append(target);

        render(<KeyboardClickHints />);

        fireEvent.keyDown(window, {
            code: "Slash",
            ctrlKey: true,
            key: "/",
        });

        expect(screen.getByText("AA")).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "a" });
        fireEvent.keyDown(window, { key: "a" });
        fireEvent.keyDown(window, { key: "Enter" });

        await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
        expect(screen.queryByText("AA")).not.toBeInTheDocument();
    });
});
