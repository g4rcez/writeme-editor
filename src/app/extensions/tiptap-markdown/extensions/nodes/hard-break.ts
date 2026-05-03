import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "@tiptap/pm/markdown";
import type { SerializeContext } from "../../serialize/types";
import HTMLNode from "./html";

const HardBreak = Node.create({
  name: "hardBreak",
});

export default HardBreak.extend({
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
          parent: ProseMirrorNode,
          index: number,
        ) {
          for (let i = index + 1; i < parent.childCount; i++)
            if (parent.child(i).type != node.type) {
              state.write(
                state.inTable
                  ? HTMLNode.storage.markdown.serialize.call(
                      this,
                      state,
                      node,
                      parent,
                    )
                  : "",
              );
              return;
            }
        },
        parse: {},
      },
    };
  },
});
