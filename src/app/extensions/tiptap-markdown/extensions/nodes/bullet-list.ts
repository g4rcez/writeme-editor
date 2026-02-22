import { Node } from "@tiptap/core";

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
        serialize(state, node) {
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
