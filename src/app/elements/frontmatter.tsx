import { Node, mergeAttributes } from "@tiptap/core";
import markdownItFrontMatter from "markdown-it-front-matter";

export const Frontmatter = Node.create({
  name: "frontmatter",
  group: "block",
  content: "text*",
  code: true,
  defining: true,
  isolating: true,
  atom: false,

  addOptions() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write("---\n");
          state.text(node.textContent, false);
          state.write("\n---\n");
          state.closeBlock(node);
        },
        parse: {
          setup(markdownit: any) {
            markdownit.use(markdownItFrontMatter, (fm: string) => {
              // content is available in token.meta
            });
            // Copy meta to content so Tiptap picks it up
            markdownit.core.ruler.push("front_matter_copy", (state: any) => {
              if (
                state.tokens.length > 0 &&
                state.tokens[0].type === "front_matter"
              ) {
                state.tokens[0].content = state.tokens[0].meta;
              }
            });
          },
          front_matter: {
            block: true,
          },
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'pre[data-type="frontmatter"]', preserveWhitespace: "full" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, { "data-type": "frontmatter" }),
      ["code", { class: "language-yaml" }, 0],
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-f": () => this.editor.commands.insertContent("---\n\n---"),
    };
  },
});
