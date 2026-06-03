import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

const OrderedList = Node.create({
  name: "orderedList",
});

function findIndexOfAdjacentNode(
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  index: number,
) {
  let i = 0;
  for (; index - i > 0; i++) {
    if (parent.child(index - i - 1).type.name !== node.type.name) {
      break;
    }
  }
  return i;
}

export default OrderedList.extend({
  /**
   * @return {{markdown: MarkdownNodeSpec}}
   */
  addStorage() {
    return {
      markdown: {
        serialize(
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
          parent: ProseMirrorNode,
          index: number,
        ) {
          const start = node.attrs.start || 1;
          const maxW = String(start + node.childCount - 1).length;
          const space = state.repeat(" ", maxW + 2);
          const adjacentIndex = findIndexOfAdjacentNode(node, parent, index);
          const separator = adjacentIndex % 2 ? ") " : ". ";
          const tightNode =
            node.attrs.tight !== true
              ? node.type.create(
                  { ...node.attrs, tight: true },
                  node.content,
                  node.marks,
                )
              : node;
          state.renderList(tightNode, space, (i: number) => {
            const nStr = String(start + i);
            return state.repeat(" ", maxW - nStr.length) + nStr + separator;
          });
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
