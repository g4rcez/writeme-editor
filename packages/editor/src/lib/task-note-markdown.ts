import { parse } from "yaml";

export function isTaskNoteMarkdown(content: string): boolean {
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    if (!frontmatter) return false;
    try {
        const metadata: unknown = parse(frontmatter);
        return !!metadata && typeof metadata === "object" && "type" in metadata && metadata.type === "task";
    } catch {
        return false;
    }
}
