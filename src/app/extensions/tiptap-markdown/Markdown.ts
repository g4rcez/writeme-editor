import { Extension } from "@tiptap/core";
import { MarkdownTightLists } from "./extensions/tiptap/tight-lists";
import { MarkdownSerializer } from "./serialize/MarkdownSerializer";
import { MarkdownParser } from "./parse/MarkdownParser";
import { MarkdownClipboard } from "./extensions/tiptap/clipboard";
import { safeMarkdown } from "../../../lib/encoding";

export const Markdown = Extension.create({
  name: "markdown",
  priority: 50,
  addOptions() {
    return {
      html: true,
      breaks: true,
      linkify: true,
      tightLists: true,
      inlineMath: false,
      bulletListMarker: "-",
      tightListClass: "tight",
      transformCopiedText: true,
      transformPastedText: true,
      onBeforePaste: (text: string) => {
        return safeMarkdown(text);
      },
    };
  },
  addCommands() {
    return {
      setContent:
        (content, options) =>
        ({ editor, tr, dispatch }) => {
          const doc = editor.storage.markdown.parser.parse(content);
          if (dispatch) {
            const transaction = tr
              .setMeta("preventUpdate", true)
              .replaceWith(0, tr.doc.content.size, doc);
            if (options?.emitUpdate) {
              transaction.setMeta("preventUpdate", false);
            }
          }
          return true;
        },
      insertContentAt:
        (_, content) =>
        ({ editor }) => {
          const doc = editor.storage.markdown.parser.parse(content, {
            inline: true,
          });
          return true;
        },
    };
  },
  onBeforeCreate() {
    this.editor.storage.markdown = {
      options: { ...this.options },
      parser: new MarkdownParser(this.editor, this.options),
      serializer: new MarkdownSerializer(this.editor),
      getMarkdown: () => {
        return this.editor.storage.markdown.serializer.serialize(
          this.editor.state.doc,
        );
      },
    };
    this.editor.options.initialContent = this.editor.options.content;
    this.editor.options.content = this.editor.storage.markdown.parser.parse(
      this.editor.options.content,
    );
  },
  onCreate() {
    this.editor.options.content = this.editor.options.initialContent;
    delete this.editor.options.initialContent;
  },
  addExtensions() {
    return [
      MarkdownTightLists.configure({
        tight: this.options.tightLists,
        tightClass: this.options.tightListClass,
      }),
      MarkdownClipboard.configure({
        transformPastedText: this.options.transformPastedText,
        transformCopiedText: this.options.transformCopiedText,
        onBeforePaste: this.options.onBeforePaste,
      }),
    ];
  },
});
