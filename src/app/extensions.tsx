import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";
import { AnyExtension, nodeInputRule, PasteRule } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import FileHandler from "@tiptap/extension-file-handler";
import { Heading } from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import { ImageExtension } from "@/app/extensions/image-extension";
import { TaskList } from "@tiptap/extension-list";
import { InlineMath } from "@tiptap/extension-mathematics";
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

export const handleImageFile = async (
  currentEditor: any,
  file: File,
  pos: number | null = null,
  offset: number = 0,
) => {
  if (!currentEditor) {
    console.error("[handleImageFile] no editor");
    return;
  }
  const insertPos = pos !== null ? pos : currentEditor.state.selection.anchor;
  console.log("[handleImageFile] entry", {
    name: file.name,
    type: file.type,
    size: file.size,
    isElectron: isElectron(),
    insertPos,
  });
  const fileReader = new FileReader();
  fileReader.readAsDataURL(file);
  fileReader.onload = async () => {
    console.log(
      "[handleImageFile] onload fired, src length:",
      (fileReader.result as string).length,
      "insertPos:",
      insertPos,
    );
    let src = fileReader.result as string;

    if (isElectron()) {
      const state = globalState();
      const projectDir = state.settings.directory;
      const noteTitle = state.note?.title || "untitled";

      if (projectDir) {
        // Sanitize note title to be OS-safe
        const sanitizedTitle = noteTitle
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        const targetDir = `${projectDir}/assets/${sanitizedTitle}`;

        try {
          console.log("[handleImageFile] mkdir", targetDir);
          await window.electronAPI.fs.mkdir(targetDir);
          const dirContents = await window.electronAPI.fs.readDir(targetDir);
          const index =
            dirContents.entries.filter((e: any) => e.type === "file").length +
            1 +
            offset;
          console.log(
            "[handleImageFile] readDir index",
            index,
            "entries",
            dirContents.entries.length,
          );
          const ext = file.type.split("/")[1] || "png";
          const filename = `${Date.now()}_${index}.${ext}`;
          const absolutePath = `${targetDir}/${filename}`;

          const result = await window.electronAPI.fs.writeImage(
            absolutePath,
            src,
          );
          console.log("[handleImageFile] writeImage result", result);
          if (result.success) {
            // Update src to be relative path for markdown
            src = `assets/${sanitizedTitle}/${filename}`;
          }
        } catch (e) {
          console.error("Failed to save image to filesystem", e);
        }
      }
    }

    currentEditor
      .chain()
      .insertContentAt(insertPos, { type: "image", attrs: { src } })
      .focus()
      .run();
  };
};

export const createExtensions = (
  getCurrentTheme: () => BundledTheme,
): AnyExtension[] => {
  return [
    Frontmatter,
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      // @ts-ignore
      inlineMath: false,
      undoRedo: { depth: 20 },
      code: { HTMLAttributes: { class: "inline-code" } },
      bulletList: { keepMarks: true, keepAttributes: true },
      orderedList: { keepAttributes: true, keepMarks: true },
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
    ImageExtension,
    FileHandler.configure({
      allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      onDrop: (currentEditor, files, pos) => {
        files.forEach((file) => {
          const fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = () => {
            console.log({ file });
            currentEditor
              .chain()
              .insertContentAt(pos, {
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
      onPaste: (currentEditor, files, htmlContent) => {
        console.log(files);
        files.forEach((file) => {
          if (htmlContent) {
            return false;
          }
          const fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = () => {
            const x = `![${file.name}](${fileReader.result} "${file.name}")`;
            currentEditor
              .chain()
              .insertContent(x, {
                applyPasteRules: true,
                parseOptions: {
                  preserveWhitespace: "full",
                  to: currentEditor.state.selection.anchor,
                  from: currentEditor.state.selection.anchor,
                },
              })
              .focus()
              .run();
          };
        });
      },
    }),
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
    InlineMath,
    TaskList,
    TaskListItem,
    YoutubeBlock,
    Callout,
    Hashtag,
    ReplacerCommands,
    GlobalDragHandle.configure({ dragHandleWidth: 24, scrollTreshold: 100 }),
    Mention.extend({
      addAttributes() {
        return {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-id"),
            renderHTML: (attributes) => {
              if (!attributes.id) {
                return {};
              }
              return { "data-id": attributes.id };
            },
          },
          label: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-label"),
            renderHTML: (attributes) => {
              if (!attributes.label) {
                return {};
              }
              return { "data-label": attributes.label };
            },
          },
          path: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("href") || element.getAttribute("data-path"),
            renderHTML: (attributes) => {
              if (!attributes.path) {
                return {};
              }
              return { "data-path": attributes.path };
            },
          },
        };
      },
      renderText({ node }) {
        return node.attrs.label ?? node.attrs.id;
      },
      renderHTML({ node }) {
        const label = node.attrs.label ?? node.attrs.id;
        const path = node.attrs.path ?? `app://note/${node.attrs.id}`;
        return [
          "a",
          {
            href: path,
            title: "writeme-mention:" + node.attrs.id,
            class: "mention",
            "data-type": "mention",
            "data-id": node.attrs.id,
            "data-label": label,
            "data-path": path,
          },
          label,
        ];
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
                    attrs: {
                      id: match[1],
                      label: match[1],
                      path: `app://note/${match[1]}`,
                    },
                  })
                  .run();
              }
            },
          }),
          new PasteRule({
            find: /\[([^\]]+)\]\(([^)"]+)(?: "writeme-mention:([^"]+)")?\)/g,
            handler: ({ match, chain, range }: any) => {
              if (match[3]) {
                chain()
                  .insertContentAt(range, {
                    type: this.type.name,
                    attrs: { label: match[1], path: match[2], id: match[3] },
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
              return {
                id: match[1],
                label: match[1],
                path: `app://note/${match[1]}`,
              };
            },
          }),
          nodeInputRule({
            find: /\[([^\]]+)\]\(([^)"]+) "writeme-mention:([^"]+)"\)$/,
            type: this.type,
            getAttributes: (match) => {
              return { label: match[1], path: match[2], id: match[3] };
            },
          }),
        ];
      },
    }).configure({
      suggestion: suggestion,
      HTMLAttributes: { class: "mention" },
      markdown: {
        parse: {
          setup(marked: any) {
            marked.use({
              extensions: [
                {
                  name: "mention_link",
                  level: "inline",
                  start(src: string) {
                    return src.indexOf("[");
                  },
                  tokenizer(src: string) {
                    const match = src.match(
                      /^\[([^\]]+)\]\(([^)"]+) "writeme-mention:([^"]+)"\)/,
                    );
                    if (match) {
                      return {
                        type: "mention_link",
                        raw: match[0],
                        label: match[1],
                        path: match[2],
                        id: match[3],
                      };
                    }
                    return undefined;
                  },
                  renderer(token: any) {
                    return `<a href="${token.path}" data-type="mention" data-id="${token.id}" data-label="${token.label}" data-path="${token.path}" class="mention" title="writeme-mention:${token.id}">${token.label}</a>`;
                  },
                },
                {
                  name: "wikilink_mention",
                  level: "inline",
                  start(src: string) {
                    return src.indexOf("[[");
                  },
                  tokenizer(src: string) {
                    const match = src.match(/^\[\[([^\]]+)\]\]/);
                    if (match) {
                      return {
                        type: "wikilink_mention",
                        raw: match[0],
                        id: match[1],
                      };
                    }
                    return undefined;
                  },
                  renderer(token: any) {
                    return `<span data-type="mention" data-id="${token.id}" data-label="${token.id}" class="mention">[[${token.id}]]</span>`;
                  },
                },
              ],
            });
          },
        },
        serialize(state: any, node: any) {
          if (node && node.attrs) {
            const label = node.attrs.label ?? node.attrs.id;
            const path = node.attrs.path ?? `app://note/${node.attrs.id}`;
            const id = node.attrs.id;
            state.write(`[${label}](${path} "writeme-mention:${id}")`);
          }
        },
      },
    }),
    Markdown,
  ];
};
