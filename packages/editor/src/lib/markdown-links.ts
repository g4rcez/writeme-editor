export function escapeMarkdownLinkLabel(label: string): string {
    return label.replace(/[\\[\]*_`~<>]/g, "\\$&");
}

export function encodeMarkdownFilePath(path: string): string {
    return path
        .split("/")
        .map((part) =>
            encodeURIComponent(part).replace(/[()']/g, (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`),
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
