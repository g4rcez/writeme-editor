import { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { processMarkdown } from "@/lib/markdown-worker/markdown.worker";
import { Markdown } from "../../extensions/tiptap-markdown/Markdown";
import { ShikiBlock } from "../code-block";
import { encodeCodeResult, type CodeExecutionResult } from "./code-result";

const result: CodeExecutionResult = {
    version: 1,
    executedAt: "2026-10-14T12:30:00.000Z",
    language: "javascript",
    sourceFingerprint: "a".repeat(64),
    stdout: "saved <script>alert(1)</script> 🌱",
    stderr: "warning",
};

function editor(content: string): Editor {
    return new Editor({
        extensions: [StarterKit.configure({ codeBlock: false }), ShikiBlock, Markdown],
        content,
    });
}

describe("kept result Markdown", () => {
    it.each([
        { name: "longer backtick closer", opener: "```", closer: "````", code: "2 + 2" },
        { name: "longer tilde closer", opener: "~~~", closer: "~~~~~", code: "2 + 2" },
        { name: "empty backtick block", opener: "```", closer: "````", code: "" },
        { name: "empty tilde block", opener: "~~~", closer: "~~~", code: "" },
        { name: "indented fences", opener: "  ```", closer: "   ```` \t", code: "2 + 2" },
        {
            name: "non-closing fence lines",
            opener: "````",
            closer: "`````",
            code: "~~~\n```\n````~\n````not a closer\n    ````\n2 + 2",
        },
        { name: "trailing source newline", opener: "```", closer: "````", code: "2 + 2\n" },
    ])("keeps document structure through $name and adjacent result roundtrips", ({ opener, closer, code }) => {
        const secondResult = { ...result, stdout: "second saved result" };
        const encoded = encodeCodeResult(result);
        const secondEncoded = encodeCodeResult(secondResult);
        const markdown = [
            `<!-- writeme-code-result:v1:${encoded} -->`,
            `${opener}javascript title="first.js"`,
            ...(code ? [code] : []),
            closer,
            "",
            "# Following section",
            "",
            "Following prose.",
            "",
            `<!-- writeme-code-result:v1:${secondEncoded} -->`,
            "~~~javascript",
            '"second"',
            "~~~~",
            "",
            "```javascript",
            '"unsaved"',
            "```",
        ].join("\n");
        const instance = editor("");
        try {
            for (const { html, plainCode } of [
                { html: instance.storage.markdown.parser!.parse(markdown), plainCode: '"unsaved"' },
                { html: processMarkdown(markdown), plainCode: '"unsaved"\n' },
            ]) {
                const container = document.createElement("div");
                container.innerHTML = html;
                expect(Array.from(container.querySelectorAll("pre, h1, p"), (node) => node.tagName)).toEqual([
                    "PRE",
                    "H1",
                    "P",
                    "PRE",
                    "PRE",
                ]);
                expect(container.querySelector("h1")?.textContent).toBe("Following section");
                expect(container.querySelector("p")?.textContent).toBe("Following prose.");
                expect(Array.from(container.querySelectorAll("pre code"), (node) => node.textContent)).toEqual([
                    code,
                    '"second"',
                    plainCode,
                ]);
                expect(
                    Array.from(container.querySelectorAll("pre"), (node) =>
                        node.getAttribute("data-writeme-execution-result"),
                    ),
                ).toEqual([encoded, secondEncoded, null]);
            }
            instance.commands.setContent(markdown);
            for (let iteration = 0; iteration < 3; iteration++) {
                const nodes = Array.from(instance.state.doc.content.content);
                expect(nodes.map((node) => node.type.name)).toEqual([
                    "codeBlock",
                    "heading",
                    "paragraph",
                    "codeBlock",
                    "codeBlock",
                    "paragraph",
                ]);
                expect(nodes.map((node) => node.textContent)).toEqual([
                    code,
                    "Following section",
                    "Following prose.",
                    '"second"',
                    '"unsaved"',
                    "",
                ]);
                expect(JSON.parse(nodes[0]!.attrs.executionResult)).toEqual(result);
                expect(nodes[0]!.attrs.title).toBe("first.js");
                expect(JSON.parse(nodes[3]!.attrs.executionResult)).toEqual(secondResult);
                expect(nodes[4]!.attrs.executionResult).toBeNull();
                instance.commands.setContent(instance.getMarkdown());
            }
        } finally {
            instance.destroy();
        }
    });

    it("preserves saved code and uneven tables together in both parsers", () => {
        const encoded = encodeCodeResult(result);
        const source = `<!-- writeme-code-result:v1:${encoded} -->\n\`\`\`javascript\n2 + 2\n\`\`\`\n\n| A | B |\n| --- | --- | --- |\n| one | two | three |`;
        const instance = editor("");
        try {
            for (const html of [instance.storage.markdown.parser!.parse(source), processMarkdown(source)]) {
                const container = document.createElement("div");
                container.innerHTML = html;
                expect(container.querySelector("pre")?.getAttribute("data-writeme-execution-result")).toBe(encoded);
                expect(container.querySelector("pre code")?.textContent).toBe("2 + 2");
                expect(
                    Array.from(container.querySelectorAll("tr"), (row) =>
                        Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent),
                    ),
                ).toEqual([
                    ["A", "B", ""],
                    ["one", "two", "three"],
                ]);
            }
        } finally {
            instance.destroy();
        }
    });

    it("copies the complete code/result pair as portable Markdown", () => {
        const markdown = `<!-- writeme-code-result:v1:${encodeCodeResult(result)} -->\n\`\`\`javascript\n2 + 2\n\`\`\``;
        const instance = editor(markdown);
        let copy: Editor | undefined;
        try {
            const serialize = instance.view.someProp("clipboardTextSerializer");
            expect(serialize).toBeDefined();
            const copied = serialize!(new Slice(instance.state.doc.content, 0, 0), instance.view);
            expect(copied).toContain("<!-- writeme-code-result:v1:");
            copy = editor(copied);
            expect(copy.state.doc.firstChild!.textContent).toBe("2 + 2");
            expect(JSON.parse(copy.state.doc.firstChild!.attrs.executionResult)).toEqual(result);
        } finally {
            instance.destroy();
            copy?.destroy();
        }
    });

    it("preserves result attributes in HTML clipboard copies without executing their contents", () => {
        const original = editor("");
        const copy = editor("");
        try {
            const document = original.schema.nodeFromJSON({
                type: "doc",
                content: [
                    {
                        type: "codeBlock",
                        attrs: { language: "javascript", executionResult: JSON.stringify(result) },
                        content: [{ type: "text", text: "2 + 2" }],
                    },
                ],
            });
            original.view.dispatch(original.state.tr.replaceWith(0, original.state.doc.content.size, document.content));
            const html = original.getHTML();
            expect(html).not.toContain("<script>");
            copy.commands.setContent(html);
            expect(JSON.parse(copy.state.doc.firstChild!.attrs.executionResult)).toEqual(result);
        } finally {
            original.destroy();
            copy.destroy();
        }
    });

    it("ignores malformed metadata without swallowing source or attaching to the next block", () => {
        const instance = editor(
            '<!-- writeme-code-result:v1:invalid -->\n```javascript\n"first"\n```\n\n```javascript\n"second"\n```',
        );
        try {
            const blocks: string[] = [];
            instance.state.doc.descendants((node) => {
                if (node.type.name !== "codeBlock") return;
                expect(node.attrs.executionResult).toBeNull();
                blocks.push(node.textContent);
            });
            expect(blocks).toEqual(['"first"', '"second"']);
        } finally {
            instance.destroy();
        }
    });

    it("retains result metadata and exact source through repeated rich/raw roundtrips", () => {
        const source = 'const fence = "```";\n\n';
        const markdown = `<!-- writeme-code-result:v1:${encodeCodeResult(result)} -->\n\`\`\`\`javascript title="sample.js"\n${source}\n\`\`\`\``;
        const instance = editor(markdown);
        try {
            for (let iteration = 0; iteration < 3; iteration++) {
                expect(JSON.parse(instance.state.doc.firstChild!.attrs.executionResult)).toEqual(result);
                expect(instance.state.doc.firstChild!.textContent).toBe(source);
                expect(instance.state.doc.firstChild!.attrs.title).toBe("sample.js");
                instance.commands.setContent(instance.getMarkdown());
            }
        } finally {
            instance.destroy();
        }
    });
});
