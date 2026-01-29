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
            
            markdownit.renderer.rules.front_matter = (tokens: any, idx: any) => {
                const token = tokens[idx];
                const content = token.meta || token.content;
                return `<pre data-type="frontmatter"><code class="language-yaml">${content}</code></pre>`;
            };
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
