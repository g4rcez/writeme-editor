import { AnyExtension, Editor } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import { Markdown } from "tiptap-markdown";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-list";
import Math from "@tiptap/extension-mathematics";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { BundledTheme } from "shiki";
import { ReplacerCommands } from "./commands/commands";
import { Blockquote } from "./elements/blockquote";
import { Callout } from "./elements/callout";
import { ShikiBlock } from "./elements/code-block";
import { MathSolver } from "./elements/math-solver";
import { TaskListItem } from "./elements/task-list-item";
import { editorGlobalRef } from "./editor-global-ref";

export const createExtensions = (
  getCurrentTheme: () => BundledTheme,
): AnyExtension[] => [
    Callout,
    TaskList,
    Highlight,
    Blockquote,
    MathSolver,
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: "tight",
      bulletListMarker: "-",
      linkify: true,
      breaks: true,
      transformPastedText: false,
      transformCopiedText: false,
    }),
    Math.configure({
      blockOptions: {
        onClick: (node, pos) => {
          const latex = prompt("Enter new calculation:", node.attrs.latex);
          if (latex) {
            editorGlobalRef.current
              ?.chain()
              .setNodeSelection(pos)
              .updateBlockMath({ latex: latex })
              .focus()
              .run();
          }
        },
      },
      inlineOptions: {
        onClick: (node) => {
          const newCalculation = prompt(
            "Enter new calculation:",
            node.attrs.latex,
          );
          if (newCalculation) {
            editorGlobalRef.current
              ?.chain()
              .setNodeSelection((node as any).pos)
              .updateInlineMath({ latex: newCalculation })
              .focus()
              .run();
          }
        },
      },
    }),
    TaskListItem,
    ReplacerCommands,
    Color.configure({ types: [TextStyle.name] }),
    Image.configure({ inline: true, allowBase64: true }),
    Placeholder.configure({ placeholder: "Untitled..." }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Typography.configure({ raquo: false, multiplication: false }),
    StarterKit.configure({
      codeBlock: false,
      blockquote: false,
      code: { HTMLAttributes: { class: "inline-code" } },
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
  ];
