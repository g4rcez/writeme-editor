import { render, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { createExtensions } from "../extensions";
import { applyPastedUrlToSelection } from "./link-paste";

const createEditor = (content: string): Editor => {
  document.elementFromPoint = () => document.body;

  return new Editor({
    content,
    extensions: createExtensions(() => "github-dark"),
  });
};

describe("link paste", () => {
  it("applies a pasted URL to selected text without replacing the label", () => {
    const editor = createEditor("selected text");

    editor.commands.setTextSelection({ from: 1, to: 14 });

    expect(applyPastedUrlToSelection(editor, "https://example.com/docs")).toBe(
      true,
    );
    expect(editor.getMarkdown()).toBe(
      "[selected text](https://example.com/docs)",
    );
    expect(editor.getJSON().content?.[0]?.content?.[0]).toMatchObject({
      type: "text",
      text: "selected text",
      marks: [
        {
          type: "link",
          attrs: { href: "https://example.com/docs" },
        },
      ],
    });

    editor.destroy();
  });

  it("keeps explicitly labelled markdown links as text links", () => {
    const editor = createEditor("[Project docs](https://example.com/docs)");

    expect(editor.getJSON().content?.[0]?.content?.[0]).toMatchObject({
      type: "text",
      text: "Project docs",
      marks: [
        {
          type: "link",
          attrs: { href: "https://example.com/docs" },
        },
      ],
    });
    expect(editor.getMarkdown()).toBe(
      "[Project docs](https://example.com/docs)",
    );
    expect(editor.getHTML()).toContain(
      'data-link-url="https://example.com/docs"',
    );

    editor.destroy();
  });

  it("renders labelled links with a full URL hover trigger", async () => {
    const editor = createEditor("[Project docs](https://example.com/docs)");
    const { container, unmount } = render(<EditorContent editor={editor} />);

    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[data-link-url="https://example.com/docs"]',
      );

      expect(link).not.toBeNull();
      expect(link?.getAttribute("title")).toBe("https://example.com/docs");
      expect(link?.textContent).toBe("Project docs");
    });

    unmount();
    editor.destroy();
  });
});
