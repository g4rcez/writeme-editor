import { parse } from "yaml";
import type { Row } from "../contracts.js";

export function savedMarkdownMetadata(
    content: string,
    warn: (message: string) => void,
): { title?: string; noteType?: string; tags: string[]; metadata: Row } {
    const result: { title?: string; noteType?: string; tags: string[]; metadata: Row } = {
        tags: [],
        metadata: {},
    };
    const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(content);
    if (frontmatter) {
        try {
            const value: unknown = parse(frontmatter[1]!, { maxAliasCount: 20 });
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const data = value as Record<string, unknown>;
                if (typeof data.title === "string") result.title = data.title;
                const type = data.noteType ?? data.type;
                if (typeof type === "string") result.noteType = type;
                if (data["excalidraw-plugin"]) result.noteType = "excalidraw";
                const tags =
                    typeof data.tags === "string"
                        ? data.tags.split(/[,\s]+/)
                        : Array.isArray(data.tags)
                          ? data.tags
                          : [];
                result.tags = tags
                    .filter((tag): tag is string => typeof tag === "string")
                    .map((tag) => tag.replace(/^#/, ""))
                    .filter(Boolean);
                // JSON round trip excludes YAML-specific object types and refuses cycles.
                result.metadata = JSON.parse(JSON.stringify(data)) as Row;
            } else if (value !== null) warn("Frontmatter must contain a mapping.");
        } catch {
            warn("Malformed Markdown frontmatter.");
        }
    }
    let fence: string | null = null;
    for (const line of content.slice(frontmatter?.[0].length ?? 0).split(/\r?\n/)) {
        const delimiter = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
        if (delimiter) {
            if (!fence) fence = delimiter;
            else if (delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = null;
            continue;
        }
        if (fence) continue;
        const prose = line.replace(/`+[^`]*`+/g, "");
        for (const match of prose.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu))
            result.tags.push(match[1]!);
    }
    result.tags = [...new Set(result.tags)];
    return result;
}
