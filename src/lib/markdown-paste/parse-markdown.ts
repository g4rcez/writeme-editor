import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  dockerfile: "docker",
  "": "markdown",
};

/**
 * Custom remark plugin to normalize code block languages.
 * Sets default language to "markdown" when missing and applies aliases.
 */
function remarkCodeBlockLanguage() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      const lang = node.lang?.toLowerCase() || "";
      node.lang = LANGUAGE_ALIASES[lang] ?? (lang || "markdown");
    });
  };
}

/**
 * Parses markdown text to HTML using unified/remark pipeline.
 * Handles GFM (GitHub Flavored Markdown) including tables, strikethrough, etc.
 *
 * Note: We do NOT pre-sanitize markdown with DOMPurify because:
 * 1. DOMPurify is designed for HTML, not markdown
 * 2. It corrupts code blocks containing HTML-like content (e.g., `<div>`)
 * 3. rehypeSanitize already sanitizes the output HTML properly
 */
export async function parseMarkdownToHtml(text: string): Promise<string> {
  console.log("[markdown-paste] Input length:", text.length);
  console.log("[markdown-paste] First 200 chars:", text.slice(0, 200));

  try {
    const result = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkCodeBlockLanguage)
      .use(remarkRehype, { allowDangerousHtml: false })
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(text);
    const html = String(result);
    console.log("[markdown-paste] Output length:", html.length);
    console.log("[markdown-paste] First 200 chars output:", html);
    return html;
  } catch (error) {
    console.error("[markdown-paste] Parse error:", error);
    throw error;
  }
}
