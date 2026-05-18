import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

function findColors(doc: Node): DecorationSet {
  const hexColor = /(#[0-9a-f]{3,6})\b/gi;
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (!node.text) {
      return;
    }
    Array.from(node.text.matchAll(hexColor)).forEach((match) => {
      const color = match[0];
      const index = match.index || 0;
      const from = position + index;
      const to = from + color.length;
      const decoration = Decoration.inline(from, to, {
        class: "color-inline-preview",
        style: `--color: ${color}`,
      });
      decorations.push(decoration);
    });
  });

  return DecorationSet.create(doc, decorations);
}

export const ColorReplacer = Extension.create({
  name: "color-replacer",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        state: {
          init(_, { doc }) {
            return findColors(doc);
          },
          apply(transaction, oldDecorations) {
            if (!transaction.docChanged)
              return oldDecorations.map(transaction.mapping, transaction.doc);
            return findColors(transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
