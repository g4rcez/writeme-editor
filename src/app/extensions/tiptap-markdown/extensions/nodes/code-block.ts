import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "@tiptap/pm/markdown";

const CodeBlock = Node.create({
  name: "codeBlock",
});

const ShikiBlock = CodeBlock.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          const titleSuffix = node.attrs.title
            ? ` title="${(node.attrs.title as string).replace(/"/g, '\\"')}"`
            : "";
          state.write("```" + (node.attrs.language || "") + titleSuffix + "\n");
          state.text(node.textContent, false);
          state.ensureNewLine();
          state.write("```");
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            element.innerHTML = element.innerHTML.replace(
              /\n<\/code><\/pre>/g,
              "</code></pre>",
            );
          },
        },
      },
    };
  },
});

export default ShikiBlock;
