const OBSIDIAN_MARKDOWN_PATTERN = /\.md$/i;

export function isObsidianMarkdownFile(filePath: string): boolean {
    return OBSIDIAN_MARKDOWN_PATTERN.test(filePath);
}

export function normalizeImportRelativePath(relativePath: string): string | null {
    const normalized = relativePath.replaceAll("\\", "/");
    const segments = normalized.split("/");
    if (
        normalized.startsWith("/") ||
        /^[A-Za-z]:\//.test(normalized) ||
        segments.length === 0 ||
        segments.some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
        return null;
    }
    return segments.join("/");
}

export function joinImportPath(rootPath: string, relativePath: string): string | null {
    const normalized = normalizeImportRelativePath(relativePath);
    if (!normalized) return null;

    const separator = rootPath.includes("\\") ? "\\" : "/";
    return `${rootPath.replace(/[\\/]+$/, "")}${separator}${normalized.replaceAll("/", separator)}`;
}

export function importFileName(relativePath: string): string {
    return relativePath.replaceAll("\\", "/").split("/").pop() ?? relativePath;
}

function canonicalImportPath(filePath: string): string {
    const normalized = filePath.replaceAll("\\", "/");
    const segments = normalized.split("/");
    const resolved: string[] = [];
    for (const segment of segments) {
        if (!segment || segment === ".") continue;
        if (segment === "..") {
            resolved.pop();
            continue;
        }
        resolved.push(segment);
    }

    const prefix = normalized.startsWith("/") ? "/" : "";
    const canonical = `${prefix}${resolved.join("/")}`.replace(/\/$/, "");
    return /^[A-Z]:/i.test(canonical) ? canonical.toLowerCase() : canonical;
}

export function isPathWithinImportRoot(rootPath: string, candidatePath: string): boolean {
    const root = canonicalImportPath(rootPath);
    const candidate = canonicalImportPath(candidatePath);
    if (root === "/") return candidate.startsWith("/");
    return candidate === root || candidate.startsWith(`${root}/`);
}
