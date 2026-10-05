const EXTERNAL_SRC_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

export const DEFAULT_ATTACHMENT_DIR = "attachments";

export function slugifyAttachmentScope(value: string): string {
    const slug = value.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return slug || "untitled";
}

export function createAttachmentDirectory(projectDir: string, noteTitle: string): string {
    return `${trimTrailingSlash(projectDir)}/${DEFAULT_ATTACHMENT_DIR}/${slugifyAttachmentScope(noteTitle)}`;
}

export function createAttachmentRelativePath(noteTitle: string, filename: string): string {
    return `${DEFAULT_ATTACHMENT_DIR}/${slugifyAttachmentScope(noteTitle)}/${filename}`;
}

export function isExternalAssetSrc(src: string): boolean {
    return EXTERNAL_SRC_PATTERN.test(src.trim());
}

export function resolveLocalAssetCandidates({
    src,
    projectDir,
    noteFilePath,
}: {
    src: string;
    projectDir: string;
    noteFilePath?: string | null;
}): string[] {
    const cleanSrc = src.trim();
    if (!cleanSrc || isExternalAssetSrc(cleanSrc)) {
        return [];
    }

    const cleanProjectDir = trimTrailingSlash(projectDir);
    const assetPath = stripQueryAndHash(cleanSrc);
    if (!assetPath) {
        return [];
    }

    const noteDir = noteFilePath ? dirname(noteFilePath) : null;
    const roots = getCandidateRoots(assetPath, cleanProjectDir, noteDir);
    const pathFromRoot = assetPath.replace(/^\/+/, "");

    return Array.from(
        new Set(
            roots
                .map((root) => normalizeAbsolutePath(`${root}/${pathFromRoot}`))
                .filter((path) => isPathWithinRoot(path, cleanProjectDir)),
        ),
    );
}

function getCandidateRoots(src: string, projectDir: string, noteDir: string | null): string[] {
    if (src.startsWith("/")) {
        return [projectDir];
    }

    if (src.startsWith("assets/") || src.startsWith(`${DEFAULT_ATTACHMENT_DIR}/`)) {
        return noteDir ? [projectDir, noteDir] : [projectDir];
    }

    return noteDir ? [noteDir, projectDir] : [projectDir];
}

function stripQueryAndHash(path: string): string {
    return path.split(/[?#]/)[0] ?? path;
}

function normalizeAbsolutePath(path: string): string {
    const prefix = path.startsWith("/") ? "/" : "";
    return `${prefix}${normalizePath(path)}`.replace(/\/+/g, "/");
}

function normalizePath(path: string): string {
    const parts: string[] = [];
    path.split("/").forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") {
            parts.pop();
            return;
        }
        parts.push(part);
    });
    return parts.join("/");
}

function isPathWithinRoot(path: string, root: string): boolean {
    const cleanRoot = trimTrailingSlash(root);
    return path === cleanRoot || path.startsWith(`${cleanRoot}/`);
}

function dirname(path: string): string {
    const normalized = path.replace(/\/+/g, "/");
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(0, index) : ".";
}

function trimTrailingSlash(path: string): string {
    return path.replace(/\/+$/, "");
}
