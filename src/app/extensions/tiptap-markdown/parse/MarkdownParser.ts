import { Editor } from "@tiptap/core";
import { Marked } from "marked";
import { elementFromString, extractElement, unwrapElement } from "../util/dom";
import { getMarkdownSpec } from "../util/extensions";

export class MarkdownParser {
  editor: Editor | null = null;
  md: Marked | null = null;

  constructor(
    editor: Editor,
    { breaks }: { html?: boolean; breaks?: boolean },
  ) {
    this.editor = editor;
    this.md = new Marked({ gfm: true, breaks: breaks ?? true });
    editor.extensionManager.extensions.forEach((extension) =>
      getMarkdownSpec(extension)?.parse?.setup?.call(
        { editor: this.editor, options: extension.options },
        this.md,
      ),
    );
  }

  parse(content: any, { inline }: { inline?: boolean } = {}) {
    if (typeof content === "string") {
      const renderedHTML = this.md?.parse(content) as string;
      const element = elementFromString(renderedHTML);
      this.editor.extensionManager.extensions.forEach((extension) =>
        getMarkdownSpec(extension)?.parse?.updateDOM?.call(
          { editor: this.editor, options: extension.options },
          element,
        ),
      );
      this.normalizeDOM(element, { inline, content });
      return element.innerHTML;
    }
    return content;
  }

  normalizeDOM(
    node: HTMLElement,
    { inline, content }: { inline: boolean; content: string },
  ) {
    this.normalizeBlocks(node);
    node.querySelectorAll("*").forEach((el) => {
      if (el.nextSibling?.nodeType === Node.TEXT_NODE && !el.closest("pre")) {
        el.nextSibling.textContent = el.nextSibling.textContent.replace(
          /^\n/,
          "",
        );
      }
    });
    if (inline) {
      this.normalizeInline(node, content);
    }
    return node;
  }

  normalizeBlocks(node: HTMLElement) {
    const blocks = Object.values(this.editor.schema.nodes).filter(
      (node) => node.isBlock,
    );
    const selector = blocks
      .map((block) => block.spec.parseDOM?.map((spec) => spec.tag))
      .flat()
      .filter(Boolean)
      .join(",");

    if (!selector) {
      return;
    }

    node.querySelectorAll(selector).forEach((el) => {
      if (el.parentElement.matches("p")) {
        extractElement(el);
      }
    });
  }

  normalizeInline(node: HTMLElement, content: string) {
    if (node.firstElementChild?.matches("p")) {
      const firstParagraph = node.firstElementChild;
      const { nextElementSibling } = firstParagraph;
      const startSpaces = content.match(/^\s+/)?.[0] ?? "";
      const endSpaces = !nextElementSibling
        ? (content.match(/\s+$/)?.[0] ?? "")
        : "";
      if (content.match(/^\n\n/)) {
        firstParagraph.innerHTML = `${firstParagraph.innerHTML}${endSpaces}`;
        return;
      }
      unwrapElement(firstParagraph);
      node.innerHTML = `${startSpaces}${node.innerHTML}${endSpaces}`;
    }
  }
}
