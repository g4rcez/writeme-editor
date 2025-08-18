import { Color } from "@tiptap/extension-color";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { BundledTheme } from "shiki";
import { ReplacerCommands } from "./commands/commands";
import { Callout } from "./elements/callout";
import { ShikiBlock } from "./elements/code-block";
import { MathSolver } from "./elements/math-solver";
import { TaskListItem } from "./elements/task-list-item";

export const createExtensions = (getCurrentTheme: () => BundledTheme) => [
  Placeholder.configure({ placeholder: "Untitled..." }),
  StarterKit.configure({
    codeBlock: false,
    code: { HTMLAttributes: { class: "inline-code" } },
  }),
  ShikiBlock.configure({
    getCurrentTheme,
    themeAware: true,
    exitOnArrowDown: true,
    exitOnTripleEnter: true,
    defaultTheme: getCurrentTheme(),
  }),
  TaskList,
  TaskListItem,
  Callout,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  Highlight,
  MathSolver,
  ReplacerCommands,
  Typography.configure({ raquo: false, multiplication: false }),
  Color.configure({ types: [TextStyle.name] }),
  Image.configure({ inline: true, allowBase64: true }),
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
