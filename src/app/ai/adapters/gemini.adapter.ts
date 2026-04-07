import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

export class GeminiAdapter implements AIAdapter {
  readonly id = "gemini";
  readonly name = "Google Gemini";
  readonly supportsFiles = true;
  readonly supportsOAuth = true;
  readonly defaultModel = "gemini-2.0-flash";

  async auth(
    method: "oauth" | "api-key",
    apiKey?: string,
  ): Promise<AuthCredentials> {
    if (method === "api-key") {
      return { apiKey };
    }
    // OAuth flow delegated to AuthManager.startOAuthFlow("gemini")
    // This is called by the AuthManager, not directly
    const { authManager } = await import("@/app/ai/auth/auth-manager");
    return authManager.startOAuthFlow("gemini");
  }

  async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
    if (!credentials.refreshToken) return credentials;
    try {
      const resp = await proxyFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
          client_id: getGoogleClientId(),
        }),
      });
      if (!resp.ok) return credentials;
      const data = (await resp.json()) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };
      return {
        ...credentials,
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        refreshToken: data.refresh_token ?? credentials.refreshToken,
      };
    } catch {
      return credentials;
    }
  }

  isExpired(credentials: AuthCredentials): boolean {
    return credentials.expiresAt != null && Date.now() > credentials.expiresAt;
  }

  async listModels(credentials: AuthCredentials): Promise<AIModel[]> {
    try {
      const url = new URL(
        "https://generativelanguage.googleapis.com/v1beta/models",
      );
      const headers: Record<string, string> = {};
      if (credentials.accessToken) {
        headers["Authorization"] = `Bearer ${credentials.accessToken}`;
      } else if (credentials.apiKey) {
        url.searchParams.set("key", credentials.apiKey);
      }
      const resp = await proxyFetch(url.toString(), { headers });
      if (!resp.ok) return [];
      const data = (await resp.json()) as {
        models: {
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }[];
      };
      return (data.models ?? [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m) => ({
          id: m.name.replace("models/", ""),
          name: m.displayName ?? m.name,
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
    const creds = options.credentials;
    const google = createGoogleGenerativeAI({
      apiKey: creds.apiKey ?? undefined,
      fetch: proxyFetch,
      headers: creds.accessToken
        ? { Authorization: `Bearer ${creds.accessToken}` }
        : undefined,
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
      const parts: any[] = msg.content.files.map((f) => ({
        type: "file",
        data: f.data,
        mimeType: f.mimeType,
      }));
      parts.push({ type: "text", text: msg.content.text });
      return { role: msg.role as "user" | "assistant", content: parts };
    });

    try {
      const result = streamText({
        model: google(model),
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

export function getGoogleClientId(): string {
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? "";
}

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/generative-language",
].join(" ");
