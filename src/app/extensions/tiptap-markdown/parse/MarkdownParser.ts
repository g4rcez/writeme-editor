import { Editor } from "@tiptap/core";
import { Marked } from "marked";
import { elementFromString, extractElement, unwrapElement } from "../util/dom";
import { getMarkdownSpec } from "../util/extensions";
import {
  isImageAttachmentTarget,
  isPdfAttachmentTarget,
  isVideoAttachmentTarget,
  parseObsidianLink,
} from "@/lib/obsidian-links";

function parseFenceInfo(raw: string): { lang: string; title: string | null } {
  const firstLine = raw.split("\n")[0] ?? "";
  const stripped = firstLine.replace(/^[`~]+/, "").trim();
  const titleMatch = stripped.match(/title=(?:"([^"]*)"|'([^']*)'|(\S+))/);
  const title = titleMatch
    ? (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? null)
    : null;
  const beforeTitle = titleMatch
    ? stripped.slice(0, stripped.indexOf("title=")).trim()
    : stripped;
  const lang = beforeTitle.split(/\s+/)[0] ?? "";
  return { lang, title };
}

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const appNoteUrlExtension = {
  extensions: [
    {
      name: "app_note_url",
      level: "inline" as const,
      start(src: string) {
        return src.indexOf("app://note/");
      },
      tokenizer(src: string) {
        const match = src.match(/^app:\/\/note\/([^\s<>"')\]]+)/);
        if (match) {
          return {
            type: "app_note_url",
            raw: match[0],
            href: match[0],
            id: match[1],
          };
        }
        return undefined;
      },
      renderer(token: { href: string; id: string }) {
        return `<a href="${token.href}" data-type="mention" data-id="${token.id}" data-label="${token.id}" data-path="${token.href}" class="mention" title="writeme-mention:${token.id}">${token.id}</a>`;
      },
    },
    {
      name: "mention_link",
      level: "inline" as const,
      start(src: string) {
        return src.indexOf("[");
      },
      tokenizer(src: string) {
        const match = src.match(
          /^\[([^\]]+)\]\(([^)"]+)\s+"writeme-mention:([^"]+)"\)/,
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
      renderer(token: { label: string; path: string; id: string }) {
        const label = htmlEscape(token.label);
        const path = htmlEscape(token.path);
        const id = htmlEscape(token.id);
        return `<a href="${path}" data-type="mention" data-id="${id}" data-label="${label}" data-path="${path}" class="mention" title="writeme-mention:${id}">${label}</a>`;
      },
    },
    {
      name: "obsidian_link",
      level: "inline" as const,
      start(src: string) {
        const embedIndex = src.indexOf("![[");
        const linkIndex = src.indexOf("[[");
        if (embedIndex < 0) return linkIndex;
        if (linkIndex < 0) return embedIndex;
        return Math.min(embedIndex, linkIndex);
      },
      tokenizer(src: string) {
        const match = src.match(/^!?\[\[[^\]\n]+\]\]/);
        if (match) {
          const parsed = parseObsidianLink(match[0]);
          if (!parsed) return undefined;
          return { type: "obsidian_link", ...parsed };
        }
        return undefined;
      },
      renderer(token: {
        raw: string;
        embed: boolean;
        target: string;
        alias: string | null;
        subpath: string | null;
        display: string;
      }) {
        const raw = htmlEscape(token.raw);
        const target = htmlEscape(token.target);
        const subpath = htmlEscape(token.subpath ?? "");
        const alias = htmlEscape(token.alias ?? "");
        const display = htmlEscape(token.display);
        const embed = token.embed ? "true" : "false";

        if (token.embed && isImageAttachmentTarget(token.target)) {
          return `<img src="${target}" alt="${display}" data-obsidian-embed="true" data-obsidian-raw="${raw}" data-obsidian-target="${target}" data-obsidian-subpath="${subpath}" data-obsidian-alias="${alias}" />`;
        }

        if (token.embed && isPdfAttachmentTarget(token.target)) {
          return `<div data-pdf-block data-src="${target}" data-title="${display}" data-obsidian-embed="true" data-obsidian-raw="${raw}" data-obsidian-target="${target}" data-obsidian-subpath="${subpath}" data-obsidian-alias="${alias}"></div>`;
        }

        if (token.embed && isVideoAttachmentTarget(token.target)) {
          return `<video src="${target}" title="${display}" data-obsidian-embed="true" data-obsidian-raw="${raw}" data-obsidian-target="${target}" data-obsidian-subpath="${subpath}" data-obsidian-alias="${alias}"></video>`;
        }

        return `<a href="${target}" data-type="mention" data-id="${target}" data-label="${display}" data-path="${target}" data-obsidian-link="true" data-obsidian-embed="${embed}" data-obsidian-raw="${raw}" data-obsidian-target="${target}" data-obsidian-subpath="${subpath}" data-obsidian-alias="${alias}" class="mention" title="writeme-mention:${target}">${display}</a>`;
      },
    },
  ],
};

export class MarkdownParser {
  editor: Editor | null = null;
  md: Marked | null = null;

  constructor(
    editor: Editor,
    { breaks }: { html?: boolean; breaks?: boolean },
  ) {
    this.editor = editor;
    this.md = new Marked({ gfm: true, breaks: breaks ?? true });
    this.md.use(appNoteUrlExtension);
    this.md.use({
      renderer: {
        code(token: { raw: string; text: string }) {
          const { lang, title } = parseFenceInfo(token.raw);
          const escaped = htmlEscape(token.text);
          const titleAttr = title ? ` data-title="${htmlEscape(title)}"` : "";
          const langClass = lang ? ` class="language-${lang}"` : "";
          return `<pre${titleAttr}><code${langClass}>${escaped}</code></pre>\n`;
        },
      },
    });
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
      this.editor!.extensionManager.extensions.forEach((extension) =>
        getMarkdownSpec(extension)?.parse?.updateDOM?.call(
          { editor: this.editor, options: extension.options },
          element,
        ),
      );
      this.normalizeDOM(element, { inline: inline ?? false, content });
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
        el.nextSibling.textContent = (el.nextSibling.textContent ?? "").replace(
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
    const blocks = Object.values(this.editor!.schema.nodes).filter(
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
      if (el.parentElement?.matches("p")) {
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
