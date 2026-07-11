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

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

type ModelTag = {
    name: string;
    size: number;
    model: string;
    digest: string;
    modified_at: string;
    capabilities: string[];
    details: {
        family: string;
        format: string;
        families: string[];
        parent_model: string;
        context_length: number;
        parameter_size: string;
        embedding_length: number;
        quantization_level: string;
    };
};

export class OllamaAdapter implements AIAdapter {
    readonly id = "ollama";
    readonly name = "Ollama";
    readonly supportsFiles = true;
    readonly supportsOAuth = false;
    readonly defaultModel = "llama3.2";

    async auth(_method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials> {
        return { apiKey };
    }

    async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
        return credentials;
    }

    isExpired(_credentials: AuthCredentials): boolean {
        return false;
    }

    async listModels(credentials: AuthCredentials): Promise<AIModel[]> {
        const apiHost = ollamaApiHostFromBaseUrl(credentials.baseUrl);
        try {
            const headers: Record<string, string> = {};
            if (credentials.apiKey) {
                headers.Authorization = `Bearer ${credentials.apiKey}`;
            }
            const response = await proxyFetch(`${apiHost}/api/tags`, { headers });
            if (!response.ok) return [];
            const data = (await response.json()) as { models?: ModelTag[] };
            return (data.models ?? []).map((model) => ({
                name: model.name,
                id: model.model ?? model.name,
                contextWindow: model.details.context_length,
            }));
        } catch {
            return [];
        }
    }

    async prepareFile(file: File): Promise<AIFile> {
        const mimeType = file.type || "application/octet-stream";
        const data = await file.arrayBuffer();
        return {
            id: uuidv4(),
            name: file.name,
            mimeType,
            data,
            size: file.size,
        };
    }

    async *sendMessage(
        messages: AIConversationMessage[],
        options: SendOptions,
        signal?: AbortSignal,
    ): AsyncIterable<AIStreamEvent> {
        const baseURL = normalizeBaseUrl(options.baseUrl ?? options.credentials.baseUrl);
        const ollama = createOpenAI({
            baseURL,
            apiKey: options.credentials.apiKey || "ollama",
            fetch: proxyFetch,
            name: "ollama",
        });

        const model = options.model ?? this.defaultModel;

        const mapped = messages.map((msg) => {
            if (msg.role === "system") {
                return { role: "user" as const, content: msg.content.text };
            }
            if (!msg.content.files || msg.content.files.length === 0) {
                return {
                    role: msg.role as "user" | "assistant",
                    content: msg.content.text,
                };
            }
            const parts: any[] = msg.content.files
                .filter((f) => f.mimeType.startsWith("image/"))
                .map((f) => ({
                    type: "image_url",
                    image_url: {
                        url: `data:${f.mimeType};base64,${bufferToBase64(f.data)}`,
                    },
                }));
            parts.push({ type: "text", text: msg.content.text });
            return { role: msg.role as "user" | "assistant", content: parts };
        });

        try {
            const result = streamText({
                model: ollama.chat(model),
                messages: mapped,
                system: options.systemPrompt,
                abortSignal: signal,
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens,
                tools: options.tools,
                toolChoice: options.toolChoice,
                stopWhen: options.tools ? stepCountIs(5) : undefined,
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

export function normalizeBaseUrl(baseUrl?: string): string {
    const trimmed = baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL;
    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    return withoutTrailingSlash.endsWith("/v1") ? withoutTrailingSlash : `${withoutTrailingSlash}/v1`;
}

function ollamaApiHostFromBaseUrl(baseUrl?: string): string {
    const normalized = normalizeBaseUrl(baseUrl);
    return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
}
