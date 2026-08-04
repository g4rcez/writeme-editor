import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText } from "ai";
import { v4 as uuidv4 } from "uuid";
import { proxyFetch } from "@/lib/proxy-fetch";
import type {
    AIAdapter,
    AIConversationMessage,
    AIFile,
    AIModel,
    AIStreamEvent,
    AuthCredentials,
    SendOptions,
} from "./types";
import { AI_FILE_CAPABILITIES, arrayBufferToBase64, prepareFileForCapabilities } from "./types";

const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_CLIENT_VERSION = "0.145.0";
const CODEX_USER_AGENT = `codex_cli_rs/${CODEX_CLIENT_VERSION}`;
const CODEX_DEFAULT_MODEL = "gpt-5.4-mini";
const CODEX_DEFAULT_INSTRUCTIONS = "You are Writeme Workspace AI.";

type CodexOAuthCredentials = AuthCredentials & { accessToken: string };

type OpenAIAuthClaims = {
    chatgpt_account_id?: string;
    "https://api.openai.com/auth"?: {
        chatgpt_account_id?: string;
        organizations?: Array<{ id?: string; is_default?: boolean }>;
    };
};

function parseJwtPayload<T extends object>(token: string | undefined): T | null {
    if (!token) return null;
    const [, payload] = token.split(".");
    if (!payload) return null;
    try {
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
        return JSON.parse(atob(padded)) as T;
    } catch {
        return null;
    }
}

function extractAccountIdFromToken(token: string | undefined): string | undefined {
    const claims = parseJwtPayload<OpenAIAuthClaims>(token);
    const authClaims = claims?.["https://api.openai.com/auth"];
    return (
        claims?.chatgpt_account_id ??
        authClaims?.chatgpt_account_id ??
        authClaims?.organizations?.find((organization) => organization.is_default)?.id ??
        authClaims?.organizations?.find((organization) => organization.id)?.id
    );
}

function getCodexAccountId(credentials: AuthCredentials): string | undefined {
    return (
        credentials.accountId ??
        extractAccountIdFromToken(credentials.idToken) ??
        extractAccountIdFromToken(credentials.accessToken)
    );
}

function isCodexOAuthCredentials(credentials: AuthCredentials): credentials is CodexOAuthCredentials {
    return Boolean(credentials.accessToken && getCodexAccountId(credentials));
}

function createCodexHeaders(accountId: string) {
    return {
        "ChatGPT-Account-Id": accountId,
        originator: "codex_cli_rs",
        "OpenAI-Beta": "responses=experimental",
        "x-upstream-user-agent": CODEX_USER_AGENT,
    };
}

type CodexInputItem = {
    role?: unknown;
    content?: unknown;
};

type CodexRequestBody = {
    instructions?: unknown;
    input?: unknown;
    store?: unknown;
    stream?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function createOpenAIModelRequestError(response: Response): Error {
    return new Error(`OpenAI model request failed (${response.status}).`);
}

type PrioritizedModel = AIModel & {
    priority: number;
    sourceIndex: number;
};

function getModelString(model: Record<string, unknown>, key: string): string | undefined {
    const value = model[key];
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || undefined;
}

const CODEX_MODEL_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

function parseCodexModels(payload: unknown): AIModel[] {
    if (!isRecord(payload)) return [];

    let source: unknown[] = [];
    if (Array.isArray(payload.models)) {
        source = payload.models;
    } else if (Array.isArray(payload.data)) {
        source = payload.data;
    }

    const parsed: PrioritizedModel[] = [];
    source.forEach((entry, sourceIndex) => {
        if (!isRecord(entry) || entry.visibility !== "list" || entry.supported_in_api !== true) return;

        const id = getModelString(entry, "slug");
        if (!id || !CODEX_MODEL_SLUG_PATTERN.test(id)) return;

        parsed.push({
            id,
            name: getModelString(entry, "display_name") ?? id,
            priority:
                typeof entry.priority === "number" && Number.isFinite(entry.priority)
                    ? entry.priority
                    : Number.POSITIVE_INFINITY,
            sourceIndex,
        });
    });

    parsed.sort((left, right) => {
        if (left.priority === right.priority) return left.sourceIndex - right.sourceIndex;
        return left.priority < right.priority ? -1 : 1;
    });
    return parsed.map(({ id, name }) => ({ id, name }));
}

function extractContentText(content: unknown): string | null {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return null;
    const text = content
        .map((part) => {
            if (!isRecord(part)) return null;
            return typeof part.text === "string" ? part.text : null;
        })
        .filter((part): part is string => Boolean(part?.trim()))
        .join("\n");
    return text.trim() ? text : null;
}

function isInstructionInput(item: CodexInputItem): boolean {
    return item.role === "developer" || item.role === "system";
}

export function createCodexRequestBody(rawBody: string, fallbackInstructions?: string): string {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!isRecord(parsed)) return rawBody;

    const body = parsed as CodexRequestBody;
    const input = Array.isArray(body.input) ? (body.input as CodexInputItem[]) : [];
    const instructionText =
        typeof body.instructions === "string" && body.instructions.trim()
            ? body.instructions
            : input
                  .filter(isInstructionInput)
                  .map((item) => extractContentText(item.content))
                  .filter((text): text is string => Boolean(text?.trim()))
                  .join("\n\n") ||
              fallbackInstructions ||
              CODEX_DEFAULT_INSTRUCTIONS;

    return JSON.stringify({
        ...parsed,
        instructions: instructionText,
        input: input.filter((item) => !isInstructionInput(item)),
        store: false,
        stream: true,
    });
}

function createCodexFetch(fallbackInstructions?: string) {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const nextInit: RequestInit = { ...init };
        if (typeof init?.body === "string") {
            nextInit.body = createCodexRequestBody(init.body, fallbackInstructions);
        }
        return proxyFetch(input, nextInit);
    };
}

export class OpenAIAdapter implements AIAdapter {
    readonly id = "openai";
    readonly name = "OpenAI (GPT)";
    readonly supportsFiles = true;
    readonly fileCapabilities = AI_FILE_CAPABILITIES.rasterImages;
    readonly supportsOAuth = true;
    readonly defaultModel = "gpt-4o";

    async auth(method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials> {
        if (method === "oauth") {
            const { authManager } = await import("@/app/ai/auth/auth-manager");
            await authManager.startOAuthFlow("openai");
            return {};
        }
        return { apiKey };
    }

    async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
        if (!credentials.refreshToken) return credentials;
        const { authManager } = await import("@/app/ai/auth/auth-manager");
        return authManager.refreshOpenAIToken(credentials);
    }

    isExpired(credentials: AuthCredentials): boolean {
        return credentials.expiresAt != null && Date.now() > credentials.expiresAt;
    }

    async listModels(credentials: AuthCredentials): Promise<AIModel[]> {
        if (isCodexOAuthCredentials(credentials)) {
            const accountId = getCodexAccountId(credentials);
            if (!accountId) throw new Error("OpenAI OAuth credentials are missing a ChatGPT account ID.");

            const resp = await proxyFetch(`${CODEX_BASE_URL}/models?client_version=${CODEX_CLIENT_VERSION}`, {
                headers: {
                    ...createCodexHeaders(accountId),
                    Authorization: `Bearer ${credentials.accessToken}`,
                },
            });
            if (!resp.ok) throw createOpenAIModelRequestError(resp);
            return parseCodexModels(await resp.json());
        }

        const resp = await proxyFetch("https://api.openai.com/v1/models", {
            headers: {
                Authorization: `Bearer ${credentials.apiKey ?? credentials.accessToken ?? ""}`,
            },
        });
        if (!resp.ok) throw createOpenAIModelRequestError(resp);
        const data = (await resp.json()) as { data: { id: string }[] };
        return (data.data ?? []).filter((m) => /gpt|o1|o3/.test(m.id)).map((m) => ({ id: m.id, name: m.id }));
    }

    async prepareFile(file: File): Promise<AIFile> {
        return prepareFileForCapabilities(file, this.fileCapabilities, uuidv4);
    }

    async *sendMessage(
        messages: AIConversationMessage[],
        options: SendOptions,
        signal?: AbortSignal,
    ): AsyncIterable<AIStreamEvent> {
        const codexCredentials = isCodexOAuthCredentials(options.credentials) ? options.credentials : null;
        const usesCodexBackend = codexCredentials != null;
        const openai = createOpenAI({
            apiKey: codexCredentials
                ? codexCredentials.accessToken
                : (options.credentials.apiKey ?? options.credentials.accessToken ?? ""),
            baseURL: usesCodexBackend ? CODEX_BASE_URL : undefined,
            headers: codexCredentials ? createCodexHeaders(getCodexAccountId(codexCredentials)!) : undefined,
            fetch: usesCodexBackend ? createCodexFetch(options.systemPrompt) : proxyFetch,
        });

        const model = options.model ?? (usesCodexBackend ? CODEX_DEFAULT_MODEL : this.defaultModel);

        const mapped: Array<{ role: "user" | "assistant"; content: string | any[] }> = [];
        for (const msg of messages) {
            if (msg.role === "system") {
                mapped.push({ role: "user", content: msg.content.text });
                continue;
            }
            if (!msg.content.files?.length) {
                mapped.push({ role: msg.role, content: msg.content.text });
                continue;
            }
            const parts: any[] = [];
            for (const file of msg.content.files) {
                if (!file.mimeType.startsWith("image/")) continue;
                const base64 = await arrayBufferToBase64(file.data);
                parts.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${file.mimeType};base64,${base64}`,
                    },
                });
            }
            if (msg.content.text.trim()) parts.push({ type: "text", text: msg.content.text });
            mapped.push({ role: msg.role, content: parts });
        }

        try {
            const result = streamText({
                model: usesCodexBackend ? openai.responses(model) : openai.chat(model),
                messages: mapped,
                system: options.systemPrompt,
                abortSignal: signal,
                temperature: usesCodexBackend ? undefined : options.temperature,
                maxOutputTokens: usesCodexBackend ? undefined : options.maxTokens,
                tools: options.tools,
                toolChoice: options.toolChoice,
                stopWhen: options.tools ? stepCountIs(5) : undefined,
                providerOptions: {
                    openai: {
                        store: false,
                    },
                },
            });

            for await (const chunk of result.textStream) {
                yield { type: "text", delta: chunk };
            }
            yield { type: "done" };
        } catch (err: any) {
            if (err?.name === "AbortError") {
                yield { type: "done" };
            } else {
                yield { type: "error", message: err?.message ?? String(err) };
            }
        }
    }
}
