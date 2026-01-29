import { AnyExtension } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-list";
import MathExtension from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { BundledTheme } from "shiki";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import { Markdown } from "tiptap-markdown";
import { ReplacerCommands } from "./commands/commands";
import { editorGlobalRef } from "./editor-global-ref";
import { Blockquote } from "./elements/blockquote";
import { Callout } from "./elements/callout";
import { ShikiBlock } from "./elements/code-block";
import { ColorReplacer } from "./elements/color-replacer";
import { TaskListItem } from "./elements/task-list-item";
import { Frontmatter } from "./elements/frontmatter";

export const createExtensions = (
  getCurrentTheme: () => BundledTheme,
): AnyExtension[] => {
  return [
    Frontmatter,
    StarterKit.configure({
      codeBlock: false,
      blockquote: false,
      code: { HTMLAttributes: { class: "inline-code" } },
    }),
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
    Typography.configure({ raquo: false, multiplication: false }),
    Markdown.configure({
      html: true,
      breaks: true,
      linkify: true,
      tightLists: true,
      bulletListMarker: "-",
      tightListClass: "tight",
      transformCopiedText: true,
      transformPastedText: false,
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
    ReplacerCommands,
    GlobalDragHandle.configure({ dragHandleWidth: 24, scrollTreshold: 100 }),
  ];
};
