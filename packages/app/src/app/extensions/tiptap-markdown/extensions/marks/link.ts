import { Mark } from "@tiptap/core";

const Link = Mark.create({
  name: "link",
});

export default Link.extend({
  /**
   * @return {{markdown: MarkdownMarkSpec}}
   */
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "[",
          close(state: any, mark: any) {
            return (
              "](" +
              state.esc(mark.attrs.href) +
              (mark.attrs.title ? " " + state.quote(mark.attrs.title) : "") +
              ")"
            );
          },
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
