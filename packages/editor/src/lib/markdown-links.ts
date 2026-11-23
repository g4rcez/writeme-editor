export function escapeMarkdownLinkLabel(label: string): string {
    return label.replaceAll(/[\\[\]*_`~<>]/g, String.raw`\$&`);
}

export function formatNoteHref(id: string, subpath = ""): string {
    return `/note/${encodeURIComponent(id)}${subpath}`.replaceAll(/[()\s\\"<>]/g, (value) =>
        value === "(" || value === ")"
            ? `%${value.charCodeAt(0).toString(16).toUpperCase()}`
            : encodeURIComponent(value),
    );
}

export function formatNoteMention(id: string, label: string, subpath = ""): string {
    const title = id.replaceAll("\\", String.raw`\\`).replaceAll('"', String.raw`\"`);
    return `[${escapeMarkdownLinkLabel(label)}](${formatNoteHref(id, subpath)} "writeme-mention:${title}")`;
}

export function encodeMarkdownFilePath(path: string): string {
    return path
        .split("/")
        .map((part) =>
            encodeURIComponent(part).replaceAll(/[()']/g, (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`),
        )
        .join("/");
}

export function decodeMarkdownFilePath(path: string): string {
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}
