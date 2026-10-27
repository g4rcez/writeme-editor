import { NoteType, type Note } from "@/store/note";

export type ReadItLaterStatus = "inbox" | "later" | "archive";

export type ReadItLaterState = {
    read: boolean;
    status: ReadItLaterStatus;
};

export type ReadItLaterStateUpdate = Partial<ReadItLaterState>;

export type ReadItLaterFeedItem = {
    id: string;
    title: string;
    url: string | null;
    publishedAt: string | null;
    content: string;
    description: string;
};

export type ParsedReadItLaterFeed = {
    title: string | null;
    items: ReadItLaterFeedItem[];
};

const FRONTMATTER_PATTERN = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/;
function parseFrontmatterFields(content: string): string[] {
    const fields = FRONTMATTER_PATTERN.exec(content)?.[2];
    return fields ? fields.split(/\r?\n/).filter((line) => line.trim().length > 0) : [];
}

function setFrontmatterField(lines: string[], key: "read" | "status", value: string): string[] {
    const matchingIndexes = lines
        .map((line, index) => {
            const colonIndex = line.indexOf(":");
            return colonIndex >= 0 && line.slice(0, colonIndex).trim() === key ? index : -1;
        })
        .filter((index) => index >= 0);
    const firstIndex = matchingIndexes[0];
    const next = lines.filter((_, index) => !matchingIndexes.slice(1).includes(index));
    if (firstIndex === undefined) {
        next.push(`${key}: ${value}`);
    } else {
        next[firstIndex] = `${key}: ${value}`;
    }
    return next;
}

export function getReadItLaterState(content: string): ReadItLaterState {
    const lines = parseFrontmatterFields(content);
    const readField = lines.find((line) => /^\s*read\s*:/i.test(line));
    const statusField = lines.find((line) => /^\s*status\s*:/i.test(line));
    const readValue = readField?.match(/^\s*read\s*:\s*(true|false)\s*(?:#.*)?$/i)?.[1]?.toLowerCase();
    const statusValue = statusField?.match(/^\s*status\s*:\s*([a-z-]+)\s*(?:#.*)?$/i)?.[1]?.toLowerCase();

    let status: ReadItLaterStatus = "inbox";
    if (statusValue === "later" || statusValue === "archive" || statusValue === "inbox") status = statusValue;

    return { read: readValue === "true", status };
}

export function updateReadItLaterFrontmatter(content: string, update: ReadItLaterStateUpdate = {}): string {
    const frontmatter = FRONTMATTER_PATTERN.exec(content);
    const lines = parseFrontmatterFields(content);
    const current = getReadItLaterState(content);
    const nextRead = update.read ?? current.read;
    const nextStatus = update.status ?? current.status;
    const withRead = setFrontmatterField(lines, "read", String(nextRead));
    const withStatus = setFrontmatterField(withRead, "status", nextStatus);
    const bom = frontmatter?.[1]?.startsWith("\uFEFF") ? "\uFEFF" : "";
    const body = frontmatter ? content.slice(frontmatter[0].length) : content;
    let separator = "\n\n";
    if (body.length === 0) separator = "\n";
    else if (body.startsWith("\n\n")) separator = "";
    else if (body.startsWith("\n")) separator = "\n";

    return `${bom}---\n${withStatus.join("\n")}\n---${separator}${body}`;
}

export function ensureReadItLaterFrontmatter(content: string): string {
    return updateReadItLaterFrontmatter(content);
}

export function isReadItLaterNote(note: Pick<Note, "noteType" | "metadata">): boolean {
    return note.noteType === NoteType["read-it-later"] ||
        (note.noteType === NoteType.pdf && note.metadata.readItLater === true);
}

export function isSafeHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
    } catch {
        return false;
    }
}

function findDirectChild(parent: Element, names: string[]): Element | undefined {
    const children = Array.from(parent.children);
    return names
        .map((name) => children.find((child) => child.localName.toLowerCase() === name))
        .find((child) => child !== undefined);
}

function getChildText(parent: Element, names: string[]): string {
    return findDirectChild(parent, names)?.textContent?.trim() ?? "";
}

function getFeedItemUrl(item: Element, baseUrl: string): string | null {
    const links = Array.from(item.children).filter((child) => child.localName.toLowerCase() === "link");
    const link = links.find((candidate) => {
        const relation = candidate.getAttribute("rel")?.toLowerCase();
        return !relation || relation === "alternate";
    }) ?? links[0];
    const rawUrl = link?.getAttribute("href") ?? link?.textContent?.trim();
    if (rawUrl) {
        try {
            const url = new URL(rawUrl, baseUrl);
            if ((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password) {
                return url.href;
            }
        } catch {
            return null;
        }
    }

    const id = getChildText(item, ["guid", "id"]);
    if (!isSafeHttpUrl(id)) return null;
    try {
        return new URL(id).href;
    } catch {
        return null;
    }
}

function normalizePublishedAt(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseReadItLaterFeed(xml: string, feedUrl: string): ParsedReadItLaterFeed {
    if (!isSafeHttpUrl(feedUrl)) throw new Error("Use a valid HTTP or HTTPS feed URL.");

    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) throw new Error("The feed returned invalid XML.");

    const root = document.documentElement;
    const isAtom = root.localName.toLowerCase() === "feed";
    const channel = isAtom ? root : findDirectChild(root, ["channel"]) ?? root;
    const itemElements = Array.from(channel.children).filter((element) =>
        ["item", "entry"].includes(element.localName.toLowerCase()),
    );
    const title = getChildText(channel, ["title"]) || null;
    const items = itemElements.map((item): ReadItLaterFeedItem => {
        const itemTitle = getChildText(item, ["title"]) || "Untitled feed item";
        const url = getFeedItemUrl(item, feedUrl);
        const id = getChildText(item, ["guid", "id"]) || url || `${itemTitle}:${getChildText(item, ["pubdate", "published", "updated"])}`;
        const contentElement = findDirectChild(item, ["encoded", "content", "description", "summary"]);
        const content = contentElement?.getAttribute("type") === "xhtml"
            ? contentElement.innerHTML.trim()
            : contentElement?.textContent?.trim() ?? "";
        const description = getChildText(item, ["description", "summary"]);
        const publishedAt = normalizePublishedAt(getChildText(item, ["pubdate", "published", "updated"]));

        return { id, title: itemTitle, url, publishedAt, content, description };
    });

    if (items.length === 0) throw new Error("This URL did not return an RSS or Atom feed with entries.");
    return { title, items };
}
