import { createAnthropic } from "@ai-sdk/anthropic";
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
import { AI_FILE_CAPABILITIES, arrayBufferToBase64, getAIFileKind, prepareFileForCapabilities } from "./types";

export const ANTHROPIC_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

export const ANTHROPIC_OAUTH_SCOPES =
    "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

const ANTHROPIC_BETA_HEADERS = "oauth-2025-04-20,interleaved-thinking-2025-05-14";
const ANTHROPIC_USER_AGENT = "claude-cli/2.1.2 (external, cli)";

export async function mapAnthropicMessages(messages: AIConversationMessage[]) {
    const mapped: Array<{ role: "user" | "assistant"; content: string | any[] }> = [];
    for (const message of messages) {
        if (message.role === "system") {
            mapped.push({ role: "user", content: message.content.text });
            continue;
        }
        if (!message.content.files?.length) {
            mapped.push({ role: message.role, content: message.content.text });
            continue;
        }
        const parts: any[] = [];
        for (const file of message.content.files) {
            if (getAIFileKind({ name: file.name, type: file.mimeType }) === "text") {
                const text = new TextDecoder("utf-8", { fatal: true }).decode(file.data);
                parts.push({ type: "text", text: `Attached file: ${file.name}\n\n${text}` });
                continue;
            }
            const base64 = await arrayBufferToBase64(file.data);
            if (file.mimeType.startsWith("image/")) {
                parts.push({ type: "image", source: { type: "base64", media_type: file.mimeType, data: base64 } });
            } else {
                parts.push({
                    type: "document",
                    source: { type: "base64", media_type: file.mimeType, data: base64 },
                });
            }
        }
        if (message.content.text.trim()) parts.push({ type: "text", text: message.content.text });
        mapped.push({ role: message.role, content: parts });
    }
    return mapped;
}

export class AnthropicAdapter implements AIAdapter {
    readonly id = "anthropic";
    readonly name = "Anthropic (Claude)";
    readonly supportsFiles = true;
    readonly fileCapabilities = AI_FILE_CAPABILITIES.anthropic;
    readonly supportsOAuth = true;
    readonly defaultModel = "claude-sonnet-4-20250514";

    async auth(method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials> {
        if (method === "api-key") {
            return { apiKey };
        }
        // OAuth is a two-phase flow managed by the settings UI via authManager.
        // startOAuthFlow() opens the browser; completeOAuthFlow() exchanges the code.
        const { authManager } = await import("@/app/ai/auth/auth-manager");
        await authManager.startOAuthFlow("anthropic");
        return {};
    }

    async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
        if (!credentials.refreshToken) return credentials;
        const { authManager } = await import("@/app/ai/auth/auth-manager");
        return authManager.refreshAnthropicToken(credentials);
    }

    isExpired(credentials: AuthCredentials): boolean {
        if (credentials.apiKey) return false;
        return credentials.expiresAt != null && Date.now() > credentials.expiresAt;
    }

    async listModels(credentials: AuthCredentials): Promise<AIModel[]> {
        try {
            const headers: Record<string, string> = {
                "anthropic-version": "2023-06-01",
                "user-agent": ANTHROPIC_USER_AGENT,
            };
            if (credentials.accessToken) {
                headers["Authorization"] = `Bearer ${credentials.accessToken}`;
                headers["anthropic-beta"] = ANTHROPIC_BETA_HEADERS;
            } else if (credentials.apiKey) {
                headers["x-api-key"] = credentials.apiKey;
            }
            const resp = await proxyFetch("https://api.anthropic.com/v1/models", {
                headers,
            });
            if (!resp.ok) return [];
            const data = (await resp.json()) as {
                data: { id: string; display_name?: string }[];
            };
            return (data.data ?? []).map((m) => ({
                id: m.id,
                name: m.display_name ?? m.id,
            }));
        } catch {
            return [];
        }
    }

    async prepareFile(file: File): Promise<AIFile> {
        return prepareFileForCapabilities(file, this.fileCapabilities, uuidv4);
    }

    async *sendMessage(
        messages: AIConversationMessage[],
        options: SendOptions,
        signal?: AbortSignal,
    ): AsyncIterable<AIStreamEvent> {
        const creds = options.credentials;
        const useOAuth = !!creds.accessToken && !creds.apiKey;

        const anthropic = createAnthropic({
            apiKey: useOAuth ? "oauth" : (creds.apiKey ?? ""),
            fetch: proxyFetch,
            ...(useOAuth
                ? {
                      headers: {
                          Authorization: `Bearer ${creds.accessToken}`,
                          "anthropic-beta": ANTHROPIC_BETA_HEADERS,
                          "user-agent": ANTHROPIC_USER_AGENT,
                      },
                  }
                : {}),
        });

        const model = options.model ?? this.defaultModel;

        const mapped = await mapAnthropicMessages(messages);

        try {
            const result = streamText({
                model: anthropic(model),
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
