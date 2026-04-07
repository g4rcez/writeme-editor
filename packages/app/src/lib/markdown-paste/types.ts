import type { Root } from "mdast";

export interface MarkdownParseResult {
  html: string;
  success: boolean;
}

export type RemarkPlugin = (tree: Root) => void;
