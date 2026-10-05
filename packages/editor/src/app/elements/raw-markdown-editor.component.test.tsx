import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { RawMarkdownEditor } from "./raw-markdown-editor";

const editors: ReturnType<typeof render>[] = [];

afterEach(() => {
    editors.splice(0).forEach(({ unmount }) => unmount());
});

describe("RawMarkdownEditor spellcheck attributes", () => {
    it("enables native spellcheck for prose and disables it on excluded Markdown source", async () => {
        const source = [
            "---",
            "title: hidden frontmatter",
            "---",
            "",
            "Plain prose with `inline code` and $x^2$.",
            "",
            "```ts",
            "const hidden = 1;",
            "```",
        ].join("\n");
        const result = render(
            <MemoryRouter>
                <RawMarkdownEditor
                    value={source}
                    onChange={() => { }}
                    theme="dark"
                    fontSize={16}
                    writingAssistantEnabled
                    active={false}
                />
            </MemoryRouter>,
        );
        editors.push(result);

        const content = await waitFor(() => {
            const element = result.container.querySelector<HTMLElement>(".cm-content");
            if (!element) throw new Error("CodeMirror content element was not mounted.");
            return element;
        });
        const excludedSource = Array.from(content.querySelectorAll<HTMLElement>('[spellcheck="false"]'))
            .map((element) => element.textContent ?? "")
            .join("");

        expect(content.getAttribute("spellcheck")).toBe("true");
        expect(content.getAttribute("role")).toBe("textbox");
        expect(content.getAttribute("aria-label")).toBe("Markdown note editor");
        expect(excludedSource).toContain("hidden frontmatter");
        expect(excludedSource).toContain("inline code");
        expect(excludedSource).toContain("x^2");
        expect(excludedSource).toContain("const hidden = 1;");
    });

    it("disables spelling and omits the assistant for disabled or readonly raw editors", async () => {
        const result = render(
            <RawMarkdownEditor
                value="A read-only source."
                onChange={() => { }}
                theme="dark"
                fontSize={16}
                readonly
                writingAssistantEnabled={false}
                active={false}
            />,
        );
        editors.push(result);

        const content = await waitFor(() => {
            const element = result.container.querySelector<HTMLElement>(".cm-content");
            if (!element) throw new Error("CodeMirror content element was not mounted.");
            return element;
        });

        expect(content.getAttribute("spellcheck")).toBe("false");
        expect(result.container.querySelector("[aria-label='Writing assistant']")).toBeNull();
    });
});
