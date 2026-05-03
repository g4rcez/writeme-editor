import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "@tiptap/pm/markdown";
import type { SerializeContext } from "../../serialize/types";

const BulletList = Node.create({
  name: "bulletList",
});

export default BulletList.extend({
  /**
   * @return {{markdown: MarkdownNodeSpec}}
   */
  addStorage() {
    return {
      markdown: {
        serialize(
          this: SerializeContext,
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
        ) {
          const tightNode =
            node.attrs.tight !== true
              ? node.type.create(
                  { ...node.attrs, tight: true },
                  node.content,
                  node.marks,
                )
              : node;
          return state.renderList(
            tightNode,
            "  ",
            () =>
              (this.editor.storage.markdown.options.bulletListMarker || "-") +
              " ",
          );
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
