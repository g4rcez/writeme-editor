import { Extension } from "@tiptap/core";
import { MarkdownTightLists } from "./extensions/tiptap/tight-lists";
import { MarkdownSerializer } from "./serialize/MarkdownSerializer";
import { MarkdownParser } from "./parse/MarkdownParser";
import { MarkdownClipboard } from "./extensions/tiptap/clipboard";
import { safeMarkdown } from "../../../lib/encoding";
import { linkify } from "../../../lib/link-utils";
import { elementFromString } from "./util/dom";

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
        return linkify(safeMarkdown(text));
      },
    };
  },
  addStorage() {
    return {
      options: {},
      parser: null,
      serializer: null,
      getMarkdown: null,
    };
  },
  addCommands() {
    return {
      setContent:
        (content, options) =>
        ({ editor, tr, dispatch }) => {
          const storage = (this as any).storage || editor.storage.markdown;
          if (!storage || !storage.parser) {
            return false;
          }
          try {
            const html = storage.parser.parse(content);
            if (dispatch) {
              const element = elementFromString(html);
              const doc = editor.view.domParser.parse(element);
              const transaction = tr
                .setMeta("preventUpdate", true)
                .replaceWith(0, tr.doc.content.size, doc);
              if (options?.emitUpdate) {
                transaction.setMeta("preventUpdate", false);
              }
            }
            return true;
          } catch (e) {
            console.error("Markdown setContent error:", e);
            return false;
          }
        },
      insertContentAt:
        (position, content) =>
        ({ editor, tr, dispatch }) => {
          const storage = (this as any).storage || editor.storage.markdown;
          if (!storage || !storage.parser) {
            return false;
          }
          try {
            const html = storage.parser.parse(content, {
              inline: true,
            });
            if (dispatch) {
              const element = elementFromString(html);
              const doc = editor.view.domParser.parse(element);
              const from =
                typeof position === "number" ? position : position.from;
              const to = typeof position === "number" ? position : position.to;
              tr.replaceWith(from, to, doc);
            }
            return true;
          } catch (e) {
            console.error("Markdown insertContentAt error:", e);
            return false;
          }
        },
    };
  },
  onBeforeCreate() {
    this.storage.options = { ...this.options };
    this.storage.parser = new MarkdownParser(this.editor, this.options);
    this.storage.serializer = new MarkdownSerializer(this.editor);
    this.storage.getMarkdown = () => {
      if (!this.storage.serializer || !this.editor.state.doc) return "";
      return this.storage.serializer.serialize(this.editor.state.doc);
    };
    this.editor.getMarkdown = this.storage.getMarkdown;
    if (this.editor.options.content && this.storage.parser) {
      this.editor.options.initialContent = this.editor.options.content;
      this.editor.options.content = this.storage.parser.parse(
        this.editor.options.content,
      );
    }
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
