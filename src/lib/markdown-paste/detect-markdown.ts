/**
 * Heuristics to detect if text contains markdown formatting.
 * Returns true if the text appears to be markdown content.
 */

const MARKDOWN_PATTERNS = {
  // Headings: # Heading, ## Heading, etc.
  headings: /^#{1,6}\s/m,
  // Code fences: ```lang or ```
  codeFences: /^```/m,
  // Unordered lists: - item, * item, + item
  unorderedLists: /^[\-\*\+]\s/m,
  // Ordered lists: 1. item, 2. item
  orderedLists: /^\d+\.\s/m,
  // Links: [text](url)
  links: /\[.*?\]\(.*?\)/,
  // Images: ![alt](url)
  images: /!\[.*?\]\(.*?\)/,
  // Tables: | col | col |
  tables: /^\|.+\|$/m,
  // Bold: **text** or __text__
  bold: /\*\*[^*]+\*\*|__[^_]+__/,
  // Italic: *text* or _text_ (but not inside words)
  italic: /(?:^|[^*])\*[^*\s][^*]*\*(?:[^*]|$)|(?:^|[^_])_[^_\s][^_]*_(?:[^_]|$)/,
  // Strikethrough: ~~text~~
  strikethrough: /~~[^~]+~~/,
  // Blockquotes: > text
  blockquotes: /^>\s/m,
  // Horizontal rules: ---, ***, ___
  horizontalRules: /^(?:---|\*\*\*|___)\s*$/m,
  // Inline code: `code`
  inlineCode: /`[^`]+`/,
  // Task lists: - [ ] or - [x]
  taskLists: /^[\-\*\+]\s\[[ xX]\]/m,
};

/**
 * Detects if text appears to be markdown content.
 * Uses multiple heuristics and requires either:
 * - A code fence (strong indicator)
 * - A table (strong indicator)
 * - A heading (strong indicator)
 * - 2+ other markdown patterns
 */
export function detectMarkdown(text: string): boolean {
  console.log("[markdown-detect] Input length:", text?.length);

  if (!text || typeof text !== "string") {
    console.log("[markdown-detect] Invalid input");
    return false;
  }

  // Code fences are a strong indicator
  if (MARKDOWN_PATTERNS.codeFences.test(text)) {
    console.log("[markdown-detect] Strong indicator: code fence");
    return true;
  }

  // Tables are a strong indicator
  if (MARKDOWN_PATTERNS.tables.test(text)) {
    console.log("[markdown-detect] Strong indicator: table");
    return true;
  }

  // Headings are a strong indicator
  if (MARKDOWN_PATTERNS.headings.test(text)) {
    console.log("[markdown-detect] Strong indicator: heading");
    return true;
  }

  // Count how many patterns match
  let matchCount = 0;
  const patternsToCheck = [
    MARKDOWN_PATTERNS.headings,
    MARKDOWN_PATTERNS.unorderedLists,
    MARKDOWN_PATTERNS.orderedLists,
    MARKDOWN_PATTERNS.links,
    MARKDOWN_PATTERNS.images,
    MARKDOWN_PATTERNS.bold,
    MARKDOWN_PATTERNS.strikethrough,
    MARKDOWN_PATTERNS.blockquotes,
    MARKDOWN_PATTERNS.horizontalRules,
    MARKDOWN_PATTERNS.inlineCode,
    MARKDOWN_PATTERNS.taskLists,
  ];

  for (const pattern of patternsToCheck) {
    if (pattern.test(text)) {
      matchCount++;
      // Return early if we have enough matches
      if (matchCount >= 2) {
        console.log("[markdown-detect] Match count threshold reached:", matchCount);
        return true;
      }
    }
  }

  console.log("[markdown-detect] Final match count:", matchCount, "- not markdown");
  return false;
}
