const PROXY_URL = "http://localhost:4079/proxy";
const MAX_RETRIES = 3;

function normalizeHeaders(headers: HeadersInit | undefined, extra: Record<string, string>): Headers {
    const result = new Headers(headers);
    for (const [key, value] of Object.entries(extra)) {
        result.set(key, value);
    }
    return result;
}

function resolveUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

function retryDelay(attempt: number, retryAfterHeader: string | null): number {
    if (retryAfterHeader) {
        const seconds = Number(retryAfterHeader);
        if (!Number.isNaN(seconds)) return seconds * 1000;
    }
    return 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
}

async function waitToRetry(delay: number, signal?: AbortSignal | null): Promise<void> {
    signal?.throwIfAborted();
    return new Promise<void>((resolve, reject) => {
        const cancel = (): void => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", cancel);
            reject(signal?.reason);
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", cancel);
            resolve();
        }, delay);
        signal?.addEventListener("abort", cancel, { once: true });
    });
}

export async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    init?.signal?.throwIfAborted();
    const targetUrl = resolveUrl(input);
    const headers = normalizeHeaders(init?.headers, { "x-target-url": targetUrl });
    const proxyInit: RequestInit = { ...init, headers };
    const getProxyToken = window.electronAPI?.ai?.getProxyToken;
    if (getProxyToken) {
        headers.set("x-writeme-proxy-token", await getProxyToken());
        // Keep the local session token from following an upstream redirect.
        proxyInit.redirect = "error";
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(PROXY_URL, proxyInit);
        if (response.status !== 429 || attempt === MAX_RETRIES) return response;
        await response.body?.cancel();
        await waitToRetry(retryDelay(attempt, response.headers.get("retry-after")), init?.signal);
    }

    // unreachable but satisfies TypeScript
    return fetch(PROXY_URL, proxyInit);
}
