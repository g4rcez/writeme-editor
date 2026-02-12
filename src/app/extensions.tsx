import { AnyExtension, nodeInputRule, PasteRule } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-list";
import MathExtension from "@tiptap/extension-mathematics";
import Mention from "@tiptap/extension-mention";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { BundledTheme } from "shiki";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import { ReplacerCommands } from "./commands/commands";
import { editorGlobalRef } from "./editor-global-ref";
import { Blockquote } from "./elements/blockquote";
import { Callout } from "./elements/callout";
import { ShikiBlock } from "./elements/code-block";
import { ColorReplacer } from "./elements/color-replacer";
import { Frontmatter } from "./elements/frontmatter";
import { TaskListItem } from "./elements/task-list-item";
import { Hashtag } from "./extensions/hashtag";
import { suggestion } from "./extensions/suggestion";
import { Markdown } from "./extensions/tiptap-markdown/Markdown";
import { UniqueID } from "@tiptap/extension-unique-id";
import { Heading } from "@tiptap/extension-heading";

export const createExtensions = (
  getCurrentTheme: () => BundledTheme,
): AnyExtension[] => {
  return [
    Frontmatter,
    StarterKit.configure({
      codeBlock: false,
      blockquote: false,
      undoRedo: { depth: 20 },
      code: { HTMLAttributes: { class: "inline-code" } },
    }),
    Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    UniqueID.configure({ types: ["heading"] }),
    TableKit.configure({
      table: {
        resizable: true,
        allowTableNodeSelection: true,
        lastColumnResizable: false,
      },
    }),
    Highlight,
    Blockquote,
    ColorReplacer,
    Color.configure({ types: [TextStyle.name] }),
    Image.configure({ inline: true, allowBase64: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder: "Your text here..." }),
    Typography.configure({
      raquo: false,
      multiplication: false,
      closeDoubleQuote: false,
      closeSingleQuote: false,
      openDoubleQuote: false,
      openSingleQuote: false,
    }),
    Markdown.configure({
      html: true,
      breaks: true,
      linkify: true,
      tightLists: true,
      bulletListMarker: "-",
      tightListClass: "tight",
      transformCopiedText: true,
      transformPastedText: true,
    }),
    ShikiBlock.configure({
      getCurrentTheme,
      themeAware: true,
      exitOnArrowDown: true,
      exitOnTripleEnter: true,
      defaultTheme: getCurrentTheme(),
    }),
    FileHandler.configure({
      allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      onDrop: (currentEditor, files, pos) => {
        files.forEach((file) => {
          const fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = () => {
            currentEditor
              .chain()
              .insertContentAt(pos, {
                type: "image",
                attrs: { src: fileReader.result },
              })
              .focus()
              .run();
          };
        });
      },
      onPaste: (currentEditor, files, htmlContent) => {
        files.forEach((file) => {
          if (htmlContent) {
            return false;
          }
          const fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = () => {
            currentEditor
              .chain()
              .insertContentAt(currentEditor.state.selection.anchor, {
                type: "image",
                attrs: {
                  src: fileReader.result,
                },
              })
              .focus()
              .run();
          };
        });
      },
    }),
    MathExtension.configure({
      blockOptions: {
        onClick: (node, pos) => {
          const latex = prompt("Math expression:", node.attrs.latex);
          if (latex) {
            editorGlobalRef.current
              ?.chain()
              .setNodeSelection(pos)
              .updateBlockMath({ latex })
              .focus()
              .run();
          }
        },
      },
      inlineOptions: {
        onClick: (node) => {
          const latex = prompt("Math expression:", node.attrs.latex);
          if (latex) {
            editorGlobalRef.current
              ?.chain()
              .setNodeSelection((node as any).pos)
              .updateInlineMath({ latex })
              .focus()
              .run();
          }
        },
      },
    }),
    TaskList,
    TaskListItem,
    Callout,
    Hashtag,
    ReplacerCommands,
    GlobalDragHandle.configure({ dragHandleWidth: 24, scrollTreshold: 100 }),
    Mention.extend({
      renderText({ node }) {
        return `[[${node.attrs.label ?? node.attrs.id}]]`;
      },
      renderHTML({ node }) {
        const label = node.attrs.label ?? node.attrs.id;
        return `[[${label}]]`;
      },
      addPasteRules() {
        return [
          new PasteRule({
            find: /\[\[([^\]]+)\]\]/g,
            handler: ({ match, chain, range }: any) => {
              if (match[1]) {
                chain()
                  .insertContentAt(range, {
                    type: this.type.name,
                    attrs: { id: match[1], label: match[1] },
                  })
                  .run();
              }
            },
          }),
        ];
      },
      addInputRules() {
        return [
          nodeInputRule({
            find: /\[\[([^\]]+)\]\]$/,
            type: this.type,
            getAttributes: (match) => {
              return { id: match[1], label: match[1] };
            },
          }),
        ];
      },
    }).configure({
      suggestion: suggestion,
      HTMLAttributes: { class: "mention" },
      markdown: {
        parse: {
          setup(markdownit: any) {
            markdownit.inline.ruler.push(
              "wikilink_mention",
              (state: any, silent: any) => {
                if (!state.src) return false;
                const match = state.src
                  .slice(state.pos)
                  .match(/^\[\[([^\]]+)\]\]/);
                if (!match || !match[0]) return false;
                if (!silent) {
                  const token = state.push("wikilink_mention", "span", 0);
                  token.attrs = [["id", match[1]]];
                }
                state.pos += match[0].length;
                return true;
              },
            );

            markdownit.renderer.rules.wikilink_mention = (
              tokens: any,
              idx: any,
            ) => {
              const token = tokens[idx];
              if (!token || !token.attrs || !token.attrs[0]) return "";
              const id = token.attrs[0][1];
              return `<span data-type="mention" data-id="${id}" data-label="${id}" class="mention">[[${id}]]</span>`;
            };
          },
        },
        serialize(state: any, node: any) {
          if (node && node.attrs) {
            state.write(`[[${node.attrs.label ?? node.attrs.id}]]`);
          }
        },
      },
    } as any),
  ];
};
