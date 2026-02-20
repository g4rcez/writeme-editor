import { AnyExtension, nodeInputRule, PasteRule } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import FileHandler from "@tiptap/extension-file-handler";
import { Heading } from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-list";
import BlockMath, { InlineMath } from "@tiptap/extension-mathematics";
import Mention from "@tiptap/extension-mention";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { UniqueID } from "@tiptap/extension-unique-id";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { BundledTheme } from "shiki";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import { ReplacerCommands } from "./commands/commands";
import { uiDispatch } from "@/store/ui.store";
import { editorGlobalRef } from "./editor-global-ref";
import { Blockquote } from "./elements/blockquote";
import { Callout } from "./elements/callout";
import { ShikiBlock } from "./elements/code-block";
import { ColorReplacer } from "./elements/color-replacer";
import { Frontmatter } from "./elements/frontmatter";
import { TaskListItem } from "./elements/task-list-item";
import { YoutubeBlock } from "./elements/youtube-block";
import { Hashtag } from "./extensions/hashtag";
import { suggestion } from "./extensions/suggestion";
import { Markdown } from "./extensions/tiptap-markdown/Markdown";

function removeEmptyWrappers(element: Element): void {
  const children = Array.from(element.children);
  children.forEach((child) => removeEmptyWrappers(child));
  children.forEach((child) => {
    if (
      (child.tagName === "SPAN" || child.tagName === "DIV") &&
      !child.attributes.length
    ) {
      while (child.firstChild) {
        element.insertBefore(child.firstChild, child);
      }
      element.removeChild(child);
    }
  });
}

export function cleanPastedHTML(html: string): string {
  try {
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = html;
    const elementsWithStyle = tempContainer.querySelectorAll("*[style]");
    elementsWithStyle.forEach((el) => el.removeAttribute("style"));
    const elementsWithClass = tempContainer.querySelectorAll("*[class]");
    elementsWithClass.forEach((el) => el.removeAttribute("class"));
    const elementsWithDataAttrs = tempContainer.querySelectorAll("*");
    elementsWithDataAttrs.forEach((el) => {
      Array.from(el.attributes)
        .filter((attr) => attr.name.startsWith("data-"))
        .forEach((attr) => el.removeAttribute(attr.name));
    });
    removeEmptyWrappers(tempContainer);
    return tempContainer.innerHTML;
  } catch (error) {
    console.error("Error cleaning pasted HTML:", error);
    return html;
  }
}

export const createExtensions = (
  getCurrentTheme: () => BundledTheme,
): AnyExtension[] => {
  return [
    Frontmatter,
    StarterKit.configure({
      heading: false,
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
    InlineMath,
    BlockMath.configure({
      blockOptions: {
        onClick: (node, pos) => {
          uiDispatch.setPrompt({
            open: true,
            title: "Math expression:",
            initialValue: node.attrs.latex,
            onConfirm: (latex) => {
              if (latex) {
                editorGlobalRef.current
                  ?.chain()
                  .setNodeSelection(pos)
                  .updateBlockMath({ latex })
                  .focus()
                  .run();
              }
            },
          });
        },
      },
      inlineOptions: {
        onClick: (node) => {
          uiDispatch.setPrompt({
            open: true,
            title: "Math expression:",
            initialValue: node.attrs.latex,
            onConfirm: (latex) => {
              if (latex) {
                editorGlobalRef.current
                  ?.chain()
                  .setNodeSelection((node as any).pos)
                  .updateInlineMath({ latex })
                  .focus()
                  .run();
              }
            },
          });
        },
      },
    }),
    TaskList,
    TaskListItem,
    YoutubeBlock,
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
    Markdown,
  ];
};
