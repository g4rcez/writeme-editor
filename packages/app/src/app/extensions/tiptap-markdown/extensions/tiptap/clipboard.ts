import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DOMParser, Fragment, Slice } from "@tiptap/pm/model";
import { elementFromString } from "../../util/dom";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/;

function dedent(text: string): string {
  const lines = text.split("\n");
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent < minIndent) minIndent = indent;
  }
  if (minIndent === Infinity) return text;
  return lines
    .map((line) => (line.length >= minIndent ? line.slice(minIndent) : line))
    .join("\n");
}

export const MarkdownClipboard = Extension.create({
  name: "markdownClipboard",
  addOptions() {
    return {
      transformPastedText: false,
      transformCopiedText: false,
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownClipboard"),
        props: {
          clipboardTextParser: (text, context) => {
            const dedentedText = dedent(this.options.onBeforePaste(text));
            const parsed = this.editor.storage.markdown.parser.parse(
              dedentedText,
              { inline: true },
            );
            return DOMParser.fromSchema(this.editor.schema).parseSlice(
              elementFromString(parsed),
              {
                preserveWhitespace: true,
                context,
              },
            );
          },
          /**
           * @param {import('prosemirror-model').Slice} slice
           */
          clipboardTextSerializer: (slice) => {
            if (!this.options.transformCopiedText) {
              return null;
            }
            return this.editor.storage.markdown.serializer.serialize(
              slice.content,
            );
          },
          handlePaste: (view, event) => {
            if (!this.options.transformPastedText) {
              return false;
            }
            if (!event.clipboardData) {
              return false;
            }

            let text = event.clipboardData.getData("text/plain");

            if (text) {
              text = this.options.onBeforePaste(text);
              const dedentedText = dedent(text);

              const fmMatch = dedentedText.match(FRONTMATTER_RE);
              if (fmMatch) {
                const schema = this.editor.schema;
                const fmType = schema.nodes.frontmatter;
                if (fmType) {
                  const yamlContent = fmMatch[1];
                  const body = dedentedText.slice(fmMatch[0].length);
                  const fmNode = fmType.create(
                    { language: "yaml" },
                    yamlContent ? schema.text(yamlContent) : undefined,
                  );

                  const nodes = [fmNode];
                  if (body.trim()) {
                    const bodyHtml = this.editor.storage.markdown.parser.parse(
                      body,
                      { inline: false },
                    );
                    const bodyDoc = DOMParser.fromSchema(schema).parse(
                      elementFromString(bodyHtml),
                      { preserveWhitespace: true },
                    );
                    bodyDoc.content.forEach((node) => nodes.push(node));
                  }

                  const slice = new Slice(Fragment.from(nodes), 0, 0);
                  view.dispatch(view.state.tr.replaceSelection(slice));
                  return true;
                }
              }

              const parsed = this.editor.storage.markdown.parser.parse(
                dedentedText,
                { inline: true },
              );
              const slice = DOMParser.fromSchema(this.editor.schema).parseSlice(
                elementFromString(parsed),
                {
                  preserveWhitespace: true,
                },
              );

              view.dispatch(view.state.tr.replaceSelection(slice));
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
