import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown extension", () => {
    it("does not serialize a destroyed editor", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: [StarterKit, Markdown],
            content: "Hello",
        });

        expect(editor.getMarkdown()).toBe("Hello");

        editor.destroy();

        expect(editor.getMarkdown()).toBe("");
    });
});
