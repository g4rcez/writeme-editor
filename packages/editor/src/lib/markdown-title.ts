export type MarkdownTitleMatch = {
    title: string;
    lineIndex: number;
};

function cleanMarkdownTitle(title: string): string {
    return title
        .replace(/\s+#+\s*$/, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_~`]/g, "")
        .trim();
}

export function findFirstMarkdownH1(markdown: string): MarkdownTitleMatch | null {
    const lines = markdown.split(/\r?\n/);

    for (const [lineIndex, line] of lines.entries()) {
        if (!line.trim()) continue;

        const match = line.match(/^\s*#(?!#)\s+(.+?)\s*$/);
        if (!match) return null;

        const title = cleanMarkdownTitle(match[1] ?? "");
        return title ? { title, lineIndex } : null;
    }

    return null;
}

export function replaceFirstMarkdownH1(markdown: string, title: string): string | null {
    const lines = markdown.split(/\r?\n/);
    const match = findFirstMarkdownH1(markdown);
    if (!match) return null;

    lines[match.lineIndex] = title.trim() ? `# ${title.trim()}` : "";
    const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
    return lines.join(newline);
}
