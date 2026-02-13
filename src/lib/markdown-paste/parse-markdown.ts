import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";

const LANGUAGE_ALIASES: Record<string, string> = {
  rb: "ruby",
  sh: "bash",
  yml: "yaml",
  py: "python",
  shell: "bash",
  "": "markdown",
  js: "javascript",
  ts: "typescript",
  dockerfile: "docker",
};

function remarkCodeBlockLanguage() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      const lang = node.lang?.toLowerCase() || "";
      node.lang = LANGUAGE_ALIASES[lang] ?? (lang || "markdown");
    });
  };
}

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
    return result.toString();
  } catch (error) {
    console.error("[markdown-paste] Parse error:", error);
    throw error;
  }
}
