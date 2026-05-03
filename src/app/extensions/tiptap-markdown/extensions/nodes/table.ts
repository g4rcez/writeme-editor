import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "@tiptap/pm/markdown";
import type { SerializeContext } from "../../serialize/types";
import { childNodes } from "../../util/prosemirror";
import HTMLNode from "./html";

const Table = Node.create({
  name: "table",
});

export default Table.extend({
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
        ) {
          if (!isMarkdownSerializable(node)) {
            HTMLNode.storage.markdown.serialize.call(this, state, node, parent);
            return;
          }
          state.inTable = true;
          node.forEach((row: ProseMirrorNode, _p: number, i: number) => {
            state.write("| ");
            row.forEach((col: ProseMirrorNode, _p: number, j: number) => {
              if (j) {
                state.write(" | ");
              }
              const cellContent = col.firstChild;
              if (cellContent && cellContent.content.size > 0) {
                state.renderInline(cellContent);
              }
            });
            state.write(" |");
            state.ensureNewLine();
            if (!i) {
              const delimiterRow = Array.from({ length: row.childCount })
                .map(() => "---")
                .join(" | ");
              state.write(`| ${delimiterRow} |`);
              state.ensureNewLine();
            }
          });
          state.closeBlock(node);
          state.inTable = false;
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});

function hasSpan(node: ProseMirrorNode) {
  return node.attrs.colspan > 1 || node.attrs.rowspan > 1;
}

function isMarkdownSerializable(node: ProseMirrorNode) {
  const rows = childNodes(node);
  const firstRow = rows[0];
  const bodyRows = rows.slice(1);

  if (
    !firstRow ||
    childNodes(firstRow).some(
      (cell: ProseMirrorNode) =>
        cell.type.name !== "tableHeader" ||
        hasSpan(cell) ||
        cell.childCount > 1,
    )
  ) {
    return false;
  }

  if (
    bodyRows.some((row: ProseMirrorNode) =>
      childNodes(row).some(
        (cell: ProseMirrorNode) =>
          cell.type.name === "tableHeader" ||
          hasSpan(cell) ||
          cell.childCount > 1,
      ),
    )
  ) {
    return false;
  }

  return true;
}
