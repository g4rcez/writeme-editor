import { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
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
