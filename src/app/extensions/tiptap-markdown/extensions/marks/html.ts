import type { Mark as ProseMirrorMark } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";
import { getHTMLFromFragment, Mark } from "@tiptap/core";
import type { MarkdownSerializerState } from "@tiptap/pm/markdown";
import type { SerializeContext } from "../../serialize/types";

export default Mark.create({
  name: "markdownHTMLMark",
  /**
   * @return {{markdown: MarkdownMarkSpec}}
   */
  addStorage() {
    return {
      markdown: {
        serialize: {
          open(
            this: SerializeContext,
            _state: MarkdownSerializerState,
            mark: ProseMirrorMark,
          ) {
            if (!this.editor.storage.markdown.options.html) {
              console.warn(
                `Tiptap Markdown: "${mark.type.name}" mark is only available in html mode`,
              );
              return "";
            }
            return getMarkTags(mark)?.[0] ?? "";
          },
          close(
            this: SerializeContext,
            _state: MarkdownSerializerState,
            mark: ProseMirrorMark,
          ) {
            if (!this.editor.storage.markdown.options.html) {
              return "";
            }
            return getMarkTags(mark)?.[1] ?? "";
          },
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});

function getMarkTags(mark: ProseMirrorMark): [string, string] | null {
  const schema = mark.type.schema;
  const node = schema.text(" ", [mark]);
  const html = getHTMLFromFragment(Fragment.from(node), schema);
  const match = html.match(/^(<.*?>) (<\/.*?>)$/);
  return match ? [match[1]!, match[2]!] : null;
}
