export type ObsidianLink = {
    raw: string;
    embed: boolean;
    target: string;
    alias: string | null;
    subpath: string | null;
    display: string;
};

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "ogg", "webm"]);

export function parseObsidianLink(raw: string): ObsidianLink | null {
    const match = raw.match(/^(!)?\[\[([^\]\n]+)\]\]$/);
    if (!match) return null;

    const embed = Boolean(match[1]);
    const rawBody = match[2]?.trim();
    if (!rawBody) return null;

    const [targetPart, aliasPart] = splitOnce(rawBody, "|");
    const targetWithSubpath = targetPart.trim();
    const alias = aliasPart?.trim() || null;
    const subpathMatch = targetWithSubpath.match(/([#^].*)$/);
    const subpath = subpathMatch?.[1] ?? null;
    const target = subpath ? targetWithSubpath.slice(0, -subpath.length).trim() : targetWithSubpath;

    return {
        raw,
        embed,
        target,
        alias,
        subpath,
        display: alias || targetWithSubpath,
    };
}

export function parseObsidianLinkBody(body: string, embed = false): ObsidianLink {
    const raw = `${embed ? "!" : ""}[[${body}]]`;
    return (
        parseObsidianLink(raw) ?? {
            raw,
            embed,
            target: body,
            alias: null,
            subpath: null,
            display: body,
        }
    );
}

export function formatObsidianLink({
    embed,
    target,
    subpath,
    alias,
}: {
    embed?: boolean;
    target: string;
    subpath?: string | null;
    alias?: string | null;
}): string {
    const body = `${target}${subpath ?? ""}${alias ? `|${alias}` : ""}`;
    return `${embed ? "!" : ""}[[${body}]]`;
}

export function isImageAttachmentTarget(target: string): boolean {
    return IMAGE_EXTENSIONS.has(getExtension(target));
}

export function isVideoAttachmentTarget(target: string): boolean {
    return VIDEO_EXTENSIONS.has(getExtension(target));
}

export function isPdfAttachmentTarget(target: string): boolean {
    return getExtension(target) === "pdf";
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getExtension(target: string): string {
    const clean = target.split(/[?#]/)[0] ?? target;
    return clean.split(".").pop()?.toLowerCase() ?? "";
}

function splitOnce(value: string, delimiter: string): [string, string?] {
    const index = value.indexOf(delimiter);
    if (index < 0) return [value];
    return [value.slice(0, index), value.slice(index + delimiter.length)];
}
