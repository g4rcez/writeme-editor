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
    return (url.protocol === "http:" || url.protocol === "https:") && 
           url.hostname.includes(".") && 
           url.hostname.length > 2;
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
 */
export function linkify(text: string): string {
  // This regex matches:
  // 1. Existing Markdown links or images: !?[...](...)
  // 2. Absolute URLs: https?://...
  // 3. Relative paths: \.\.?\/...
  // 4. Absolute-like paths: \/[^\s]*\.md
  const combinedRegex = /(!?\[.*?\]\(.*?\))|(https?:\/\/[^\s$.?#].[^\s]*)|(\.\.?\/[^\s]*)|(\/[^\s]*\.md)/gi;

  return text.replace(combinedRegex, (match, markdownLink, url, relativePath, absoluteLikePath) => {
    // If it matched a markdown link, return it as is
    if (markdownLink) {
      return match;
    }

    const trimmedMatch = match.trim();
    
    // Ignore simple dots or slashes
    if (trimmedMatch === "/" || trimmedMatch === "./" || trimmedMatch === "../") {
        return match;
    }

    if (isValidUrl(trimmedMatch) || isRelativeLink(trimmedMatch)) {
        return convertToMarkdownLink(trimmedMatch);
    }

    return match;
  });
}
