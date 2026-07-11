import { fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeMirrorNodeCodeEditor } from "./codemirror-node-code-editor";

type RenderCodeMirrorOptions = {
    language?: string;
    value?: string;
    isDark?: boolean;
    onChange?: (nextValue: string) => void;
    onExitDown?: () => void;
    onExitUp?: () => void;
};

function normalizeText(value: string | null): string {
    return value?.replace(/\s+/g, " ").trim() ?? "";
}

function getEditorContent(container: HTMLElement): HTMLElement {
    const content = container.querySelector<HTMLElement>('.cm-content[contenteditable="true"]');
    if (!content) throw new Error("CodeMirror content element was not rendered");
    return content;
}

function renderCodeMirrorEditor(options: RenderCodeMirrorOptions = {}) {
    const props = {
        language: options.language ?? "javascript",
        value: options.value ?? "const a = 1;",
        isDark: options.isDark ?? false,
        onChange: vi.fn(options.onChange),
        onExitDown: vi.fn(options.onExitDown),
        onExitUp: vi.fn(options.onExitUp),
    };

    const result = render(<CodeMirrorNodeCodeEditor {...props} />);
    const editorRoot = result.container.querySelector<HTMLElement>('[data-code-mirror-editor="true"]');
    if (!editorRoot) throw new Error("CodeMirror editor root was not rendered");

    return {
        ...result,
        editorRoot,
        props,
        get content() {
            return getEditorContent(result.container);
        },
    };
}

describe("CodeMirrorNodeCodeEditor", () => {
    it("renders the initial document value", () => {
        const { container } = renderCodeMirrorEditor({
            value: "const answer = 42;",
        });

        expect(normalizeText(container.textContent)).toContain("const answer = 42;");
    });

    it("uses the app color tokens", () => {
        renderCodeMirrorEditor({ isDark: true });

        const codeMirrorStyles = Array.from(
            document.querySelectorAll("style"),
            (style) => style.textContent ?? "",
        ).find((css) => css.includes("var(--foreground)") && css.includes("var(--primary)"));

        expect(codeMirrorStyles).toBeDefined();
        expect(codeMirrorStyles).not.toContain("#cba6f7");
    });

    it("synchronizes external value updates without emitting a change", async () => {
        const { container, props, rerender } = renderCodeMirrorEditor({
            value: "const answer = 42;",
        });

        rerender(
            <CodeMirrorNodeCodeEditor
                language="javascript"
                value="const updated = 43;"
                isDark={false}
                onChange={props.onChange}
                onExitDown={props.onExitDown}
                onExitUp={props.onExitUp}
            />,
        );

        await waitFor(() => {
            expect(normalizeText(container.textContent)).toContain("const updated = 43;");
        });
        expect(props.onChange).not.toHaveBeenCalled();

        rerender(
            <CodeMirrorNodeCodeEditor
                language="javascript"
                value="const updated = 43;"
                isDark={false}
                onChange={props.onChange}
                onExitDown={props.onExitDown}
                onExitUp={props.onExitUp}
            />,
        );

        expect(props.onChange).not.toHaveBeenCalled();
    });

    it("emits changes from user text input", async () => {
        const user = userEvent.setup();
        const { content, props } = renderCodeMirrorEditor({ value: "" });

        await user.click(content);
        await user.keyboard("abc");

        await waitFor(() => {
            expect(props.onChange).toHaveBeenLastCalledWith("abc");
        });
    });

    it("exits upward on one ArrowUp at the first line", async () => {
        const user = userEvent.setup();
        const { content, props } = renderCodeMirrorEditor({
            value: "const a = 1;",
        });

        await user.click(content);
        await user.keyboard("{ArrowUp}");

        expect(props.onExitUp).toHaveBeenCalledTimes(1);
        expect(props.onExitDown).not.toHaveBeenCalled();
    });

    it("exits downward on one ArrowDown at the last line", async () => {
        const user = userEvent.setup();
        const { content, props } = renderCodeMirrorEditor({
            value: "const a = 1;",
        });

        await user.click(content);
        fireEvent.keyDown(content, { key: "ArrowDown" });

        expect(props.onExitDown).toHaveBeenCalledTimes(1);
        expect(props.onExitUp).not.toHaveBeenCalled();
    });

    it("stops keydown and paste events from reaching parent bubble handlers", () => {
        const onKeyDown = vi.fn();
        const onPaste = vi.fn();
        const { container } = render(
            <div onKeyDown={onKeyDown} onPaste={onPaste}>
                <CodeMirrorNodeCodeEditor
                    language="javascript"
                    value="const a = 1;"
                    isDark={false}
                    onChange={vi.fn()}
                    onExitDown={vi.fn()}
                    onExitUp={vi.fn()}
                />
            </div>,
        );
        const content = getEditorContent(container);

        fireEvent.keyDown(content, { key: "a" });
        fireEvent.paste(content, {
            clipboardData: { getData: () => "pasted" },
        });

        expect(onKeyDown).not.toHaveBeenCalled();
        expect(onPaste).not.toHaveBeenCalled();
    });

    it("highlights math expressions with CodeMirror tokens", async () => {
        const { content } = renderCodeMirrorEditor({
            language: "math",
            value: "total = sin(42) + 2 // note",
        });

        await waitFor(() => {
            const tokenTexts = Array.from(content.querySelectorAll("span"), (span) => span.textContent?.trim());
            expect(tokenTexts).toEqual(expect.arrayContaining(["=", "sin", "42", "+", "2", "// note"]));
        });
    });

    it("highlights HTTP requests with CodeMirror tokens", async () => {
        const { content } = renderCodeMirrorEditor({
            language: "http",
            value: "POST https://example.com/api HTTP/1.1\nContent-Type: application/json",
        });

        await waitFor(() => {
            const tokenTexts = Array.from(content.querySelectorAll("span"), (span) => span.textContent?.trim());
            expect(tokenTexts).toEqual(
                expect.arrayContaining([
                    "POST",
                    "https://example.com/api",
                    "HTTP/1.1",
                    "Content-Type:",
                    "application/json",
                ]),
            );
        });
    });

    it("does not emit custom regex highlighter classes", () => {
        const { container } = renderCodeMirrorEditor({
            value: "const answer = 42;",
        });

        expect(container.querySelector('[class*="wm-cm-"]')).toBeNull();
    });
});
