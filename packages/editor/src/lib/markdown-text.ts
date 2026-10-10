type MarkdownTextOptions = {
    includeWikiSubpath?: boolean;
};

const MARKDOWN_LINK_PATTERN = /!?(?:\[([^\]]*)\])\([^)]*\)/g;
const WIKI_LINK_PATTERN = /!?\[\[([^#^|\]]+)(?:([#^][^|\]]*))?(?:\|([^\]]+))?\]\]/g;

export function markdownLineToPlainText(
    markdown: string,
    { includeWikiSubpath = false }: MarkdownTextOptions = {},
): string {
    return markdown
        .replace(MARKDOWN_LINK_PATTERN, "$1")
        .replace(
            WIKI_LINK_PATTERN,
            (_match, target: string, subpath?: string, alias?: string) =>
                alias?.trim() || `${target.trim()}${includeWikiSubpath ? (subpath ?? "") : ""}`,
        )
        .replace(/`{1,3}/g, "")
        .replace(/[*_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
