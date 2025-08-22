import { Extension, InputRule } from "@tiptap/core";

export const MarkdownTableInputRule = Extension.create({
  name: "markdownTableInputRule",

  addInputRules() {
    return [
      new InputRule({
        find: /\|(.+)\|\n\|[-:\s\|]+\|\n((?:\|.+\|\n?)*)/,
        handler: ({ state, range, match }) => {
          const [fullMatch, headerRow, bodyRows] = match;
          const headers = headerRow
            .split("|")
            .map((h) => h.trim())
            .filter((h) => h);
          const rows = bodyRows
            .trim()
            .split("\n")
            .map((row) =>
              row
                .split("|")
                .map((cell) => cell.trim())
                .filter((cell) => cell),
            );

          const { tr } = state;

          // Insert table at the matched position
          tr.delete(range.from, range.to);

          // Use the insertTable command
          this.editor.commands.insertTable({
            rows: rows.length + 1, // +1 for header
            cols: headers.length,
            withHeaderRow: true,
          });

          // Fill in the content
          // (This is simplified - you'd need to navigate to each cell and insert content)

          return tr;
        },
      }),
    ];
  },
});
