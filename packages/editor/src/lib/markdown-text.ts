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
        .replaceAll(MARKDOWN_LINK_PATTERN, "$1")
        .replaceAll(
            WIKI_LINK_PATTERN,
            (_match, target: string, subpath?: string, alias?: string) =>
                alias?.trim() || `${target.trim()}${includeWikiSubpath ? (subpath ?? "") : ""}`,
        )
        .replaceAll(/`{1,3}/g, "")
        .replaceAll(/[*_~]/g, "")
        .replaceAll(/\s+/g, " ")
        .trim();
}
