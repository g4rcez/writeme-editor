/**
 * Utility functions for handling links and converting them to Markdown format.
 */

/**
 * Validates if a string is a valid absolute URL.
 */
export function isValidUrl(text: string): boolean {
  // Must start with http:// or https:// and have a hostname with a dot
  if (!/^https?:\/\//i.test(text)) return false;

  try {
    const url = new URL(text);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.includes(".") &&
      url.hostname.length > 2
    );
  } catch (_) {
    return false;
  }
}

/**
 * Checks if a string is a relative markdown link (e.g., ./path/to/file.md).
 */
export function isRelativeLink(text: string): boolean {
  // Matches ./, ../, or / followed by a path ending in .md or a folder
  const relativePathRegex = /^(\.\.?\/|\/)[^\s]*(\.md|\/)?$/i;
  return relativePathRegex.test(text);
}

/**
 * Converts a string to a Markdown link if it's a URL or a relative path and not already a Markdown link.
 */
export function convertToMarkdownLink(text: string, label?: string): string {
  const trimmed = text.trim();

  // If it's already a markdown link [text](url) or ![alt](url), don't convert
  if (/^!?\[.*\]\(.*\)$/.test(trimmed)) {
    return trimmed;
  }

  if (isValidUrl(trimmed) || isRelativeLink(trimmed)) {
    const displayLabel = label || trimmed;
    return `[${displayLabel}](${trimmed})`;
  }

  return text;
}

/**
 * Finds URLs and relative paths in text and converts them to Markdown links.
 * Strips wrapping < > and separates trailing punctuation.
 */
export function linkify(text: string): string {
  // This regex matches:
  // 1. Existing Markdown links or images: !?[...](...)
  // 2. Wrapped URLs or paths: <https://...> or <./path/...>
  // 3. Absolute URLs: https?://...
  // 4. Relative paths: \.\.?\/... or \/... .md
  const combinedRegex =
    /(!?\[.*?\]\(.*?\))|(<(?:https?:\/\/[^\s>]+|(?:\.\.?\/|\/)[^\s>]+)>)|(https?:\/\/[^\s<>]+)|((?:\.\.?\/|\/)[^\s<>]*(\.md|\/)?)/gi;

  return text.replace(combinedRegex, (match, markdownLink) => {
    // If it matched an existing markdown link, return it as is
    if (markdownLink) {
      return match;
    }

    let target = match.trim();

    // 1. Strip wrapping angle brackets if they exist
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }

    // 2. Separate trailing punctuation that shouldn't be part of the link
    // Includes periods, commas, exclamation marks, question marks, semicolons, colons
    const punctuationRegex = /([.,!?;:]+)$/;
    const punctuationMatch = target.match(punctuationRegex);
    let suffix = "";

    if (punctuationMatch && punctuationMatch[1]) {
      const punc = punctuationMatch[1];
      // Only strip if what's left is a valid URL or path
      const potentialUrl = target.slice(0, -punc.length);
      if (isValidUrl(potentialUrl) || isRelativeLink(potentialUrl)) {
        target = potentialUrl;
        suffix = punc;
      }
    }

    // 3. Final validation and conversion
    if (isValidUrl(target) || isRelativeLink(target)) {
      // Ignore simple dots or slashes
      if (target === "/" || target === "./" || target === "../") {
        return match;
      }
      return convertToMarkdownLink(target) + suffix;
    }

    return match;
  });
}
