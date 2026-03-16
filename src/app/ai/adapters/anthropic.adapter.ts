import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
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
  readonly supportsOAuth = false;
  readonly defaultModel = "claude-opus-4-5-20251001";

  async auth(method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials> {
    if (method === "oauth") {
      throw new Error("Anthropic does not support third-party OAuth. Use an API key.");
    }
    return { apiKey };
  }

  async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
    return credentials;
  }

  isExpired(_credentials: AuthCredentials): boolean {
    return false;
  }

  async listModels(credentials: AuthCredentials): Promise<AIModel[]> {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": credentials.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
      });
      if (!resp.ok) return [];
      const data = await resp.json() as { data: { id: string; display_name?: string }[] };
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
    const anthropic = createAnthropic({
      apiKey: options.credentials.apiKey ?? "",
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
