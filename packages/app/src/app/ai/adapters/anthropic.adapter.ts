import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { proxyFetch } from "@/lib/proxy-fetch";
import { v4 as uuidv4 } from "uuid";
import type {
  AIAdapter,
  AIConversationMessage,
  AIFile,
  AIModel,
  AIStreamEvent,
  AuthCredentials,
  SendOptions,
} from "./types";

export const ANTHROPIC_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

export const ANTHROPIC_OAUTH_SCOPES =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

const ANTHROPIC_BETA_HEADERS =
  "oauth-2025-04-20,interleaved-thinking-2025-05-14";
const ANTHROPIC_USER_AGENT = "claude-cli/2.1.2 (external, cli)";

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export class AnthropicAdapter implements AIAdapter {
  readonly id = "anthropic";
  readonly name = "Anthropic (Claude)";
  readonly supportsFiles = true;
  readonly supportsOAuth = true;
  readonly defaultModel = "claude-sonnet-4-20250514";

  async auth(
    method: "oauth" | "api-key",
    apiKey?: string,
  ): Promise<AuthCredentials> {
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
    const mimeType = file.type || "application/octet-stream";
    if (!SUPPORTED_MIME_TYPES.has(mimeType) && !mimeType.startsWith("text/")) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
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
      const parts: any[] = msg.content.files.map((f) => {
        const base64 = bufferToBase64(f.data);
        if (f.mimeType.startsWith("image/")) {
          return {
            type: "image",
            source: { type: "base64", media_type: f.mimeType, data: base64 },
          };
        }
        return {
          type: "document",
          source: { type: "base64", media_type: f.mimeType, data: base64 },
        };
      });
      parts.push({ type: "text", text: msg.content.text });
      return { role: msg.role as "user" | "assistant", content: parts };
    });

    try {
      const result = streamText({
        model: anthropic(model),
        messages: mapped,
        system: options.systemPrompt,
        abortSignal: signal,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
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

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
