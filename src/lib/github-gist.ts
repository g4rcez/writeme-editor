export type GistReference = {
    owner: string;
    gistId: string;
};

export type GithubGistFile = {
    filename: string;
    language: string | null;
    content: string;
};

export type GithubGist = {
    owner: string;
    gistId: string;
    title: string;
    description: string | null;
    url: string;
    files: GithubGistFile[];
    markdown: string;
};

type GithubGistApiFile = {
    filename: string;
    language: string | null;
    content: string;
    rawUrl: string;
    truncated: boolean;
};

const GITHUB_OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const GIST_ID_PATTERN = /^[a-f\d]+$/i;
const MARKDOWN_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;

export function parseGistReference(value: string): GistReference | null {
    const input = value.trim();
    if (!input) return null;

    let segments: string[];
    try {
        const url = new URL(input);
        if (url.hostname === "gist.github.com") {
            segments = url.pathname.split("/").filter(Boolean).slice(0, 2);
        } else if (
            url.hostname === "writeme.dev" ||
            url.hostname === "www.writeme.dev" ||
            url.hostname === "app.writeme.dev"
        ) {
            const pathSegments = url.pathname.split("/").filter(Boolean);
            segments = pathSegments[0] === "gist" ? pathSegments.slice(1, 3) : [];
        } else {
            return null;
        }
    } catch {
        segments = input.split("/").filter(Boolean);
    }

    const [owner, gistId] = segments;
    if (!owner || !gistId || segments.length !== 2) return null;
    if (!GITHUB_OWNER_PATTERN.test(owner) || !GIST_ID_PATTERN.test(gistId)) return null;

    return { owner, gistId };
}

export async function fetchGithubGist(
    reference: GistReference,
    options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<GithubGist> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`https://api.github.com/gists/${reference.gistId}`, {
        headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: options.signal,
    });

    if (!response.ok) {
        const message = await readGithubError(response);
        throw new Error(`GitHub could not load this Gist (${response.status}): ${message}`);
    }

    const payload: unknown = await response.json();
    const gist = parseGithubGistPayload(payload);
    const files = await Promise.all(
        gist.files.map(async (file): Promise<GithubGistFile> => {
            if (!file.truncated) {
                return { filename: file.filename, language: file.language, content: file.content };
            }

            const rawResponse = await fetchImpl(file.rawUrl, { signal: options.signal });
            if (!rawResponse.ok) {
                throw new Error(`GitHub could not load the complete ${file.filename} file (${rawResponse.status}).`);
            }
            return {
                filename: file.filename,
                language: file.language,
                content: await rawResponse.text(),
            };
        }),
    );

    if (files.length === 0) throw new Error("This Gist does not contain any files.");

    const owner = gist.owner || reference.owner;
    const description = gist.description?.trim() || null;
    return {
        owner,
        gistId: reference.gistId,
        title: description || files[0]?.filename || `${owner}'s Gist`,
        description,
        url: gist.url,
        files,
        markdown: buildGistMarkdown(files),
    };
}

export function buildGistMarkdown(files: GithubGistFile[]): string {
    if (files.length === 1 && files[0] && isMarkdownFile(files[0].filename)) {
        return files[0].content;
    }

    return files
        .map((file) => {
            const body = isMarkdownFile(file.filename)
                ? file.content
                : createCodeBlock(file.content, getCodeLanguage(file));
            return files.length === 1 ? body : `## ${file.filename}\n\n${body}`;
        })
        .join("\n\n");
}

function parseGithubGistPayload(payload: unknown): {
    owner: string | null;
    description: string | null;
    url: string;
    files: GithubGistApiFile[];
} {
    if (!isRecord(payload) || !isRecord(payload.files) || typeof payload.html_url !== "string") {
        throw new Error("GitHub returned an invalid Gist response.");
    }

    const files = Object.values(payload.files).map((value) => {
        if (
            !isRecord(value) ||
            typeof value.filename !== "string" ||
            typeof value.raw_url !== "string" ||
            typeof value.content !== "string"
        ) {
            throw new Error("GitHub returned an invalid Gist file.");
        }
        return {
            filename: value.filename,
            language: typeof value.language === "string" ? value.language : null,
            content: value.content,
            rawUrl: value.raw_url,
            truncated: value.truncated === true,
        };
    });

    const owner = isRecord(payload.owner) && typeof payload.owner.login === "string" ? payload.owner.login : null;
    return {
        owner,
        description: typeof payload.description === "string" ? payload.description : null,
        url: payload.html_url,
        files,
    };
}

async function readGithubError(response: Response): Promise<string> {
    try {
        const payload: unknown = await response.json();
        if (isRecord(payload) && typeof payload.message === "string") return payload.message;
    } catch {
        // Use the HTTP status text when GitHub does not return JSON.
    }
    return response.statusText || "Unknown error";
}

function createCodeBlock(content: string, language: string): string {
    const longestFence = Math.max(2, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
    const fence = "`".repeat(longestFence + 1);
    return `${fence}${language}\n${content}\n${fence}`;
}

function getCodeLanguage(file: GithubGistFile): string {
    const extension = file.filename.match(/\.([a-z\d]+)$/i)?.[1];
    if (extension) return extension.toLowerCase();
    return file.language?.toLowerCase().replace(/[^a-z\d+#.-]/g, "") ?? "";
}

function isMarkdownFile(filename: string): boolean {
    return MARKDOWN_EXTENSION_PATTERN.test(filename);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
