import { Editor } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MentionNodeView } from "../elements/mention";
import { createExtensions } from "../extensions";
import { getMentionReplacementFrom } from "./suggestion";

describe("mention link serialization", () => {
  it("does not serialize mention paths with duplicated at prefixes", () => {
    document.elementFromPoint = () => document.body;

    const editor = new Editor({
      content: "",
      extensions: createExtensions(() => "github-dark"),
    });

    editor.commands.insertContent({
      type: "mention",
      attrs: {
        id: "note-123",
        label: "Daily Log",
        path: "@mention/note/note-123",
      },
    });

    expect(editor.getMarkdown()).not.toContain("@@");
    expect(editor.getMarkdown()).toContain(
      '[Daily Log](/note/note-123 "writeme-mention:note-123")',
    );

    editor.destroy();
  });

  it("consumes the typed trigger when inserting a live note mention", () => {
    document.elementFromPoint = () => document.body;

    const editor = new Editor({
      content: "<p>@readme</p>",
      extensions: createExtensions(() => "github-dark"),
    });
    const mentionNodeType = editor.state.schema.nodes.mention;

    if (!mentionNodeType) {
      throw new Error("Mention node type is not registered");
    }

    const fromAfterTrigger = 2;
    const toAfterQuery = 8;
    const node = mentionNodeType.create({
      id: "note-123",
      label: "readme",
      path: "/note/note-123",
    });

    editor.view.dispatch(
      editor.state.tr.replaceWith(
        getMentionReplacementFrom(editor.state, fromAfterTrigger),
        toAfterQuery,
        node,
      ),
    );

    const paragraphContent = editor.getJSON().content?.[0]?.content ?? [];

    expect(paragraphContent).toHaveLength(1);
    expect(paragraphContent[0]).toMatchObject({
      type: "mention",
      attrs: {
        id: "note-123",
        label: "readme",
        path: "/note/note-123",
      },
    });
    expect(editor.getText()).not.toContain("@readme");

    editor.destroy();
  });

  it("renders one live mention class for the visual at prefix", () => {
    const editor = new Editor({
      content: "",
      extensions: createExtensions(() => "github-dark"),
    });
    const props = {
      editor,
      extension: { options: {} },
      node: {
        attrs: {
          id: "note-123",
          label: "readme",
          path: "/note/note-123",
        },
      },
    } as unknown as NodeViewProps;

    const { container, unmount } = render(<MentionNodeView {...props} />);

    expect(container.querySelectorAll(".mention-node")).toHaveLength(1);
    expect(container.querySelectorAll(".mention")).toHaveLength(1);

    unmount();
    editor.destroy();
  });
});
