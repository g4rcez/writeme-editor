import { createOpenAI } from "@ai-sdk/openai";
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

export class OpenAIAdapter implements AIAdapter {
  readonly id = "openai";
  readonly name = "OpenAI (GPT)";
  readonly supportsFiles = true;
  readonly supportsOAuth = false;
  readonly defaultModel = "gpt-4o";

  async auth(method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials> {
    if (method === "oauth") {
      throw new Error("OpenAI does not support third-party OAuth. Use an API key.");
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
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${credentials.apiKey ?? ""}` },
      });
      if (!resp.ok) return [];
      const data = await resp.json() as { data: { id: string }[] };
      return (data.data ?? [])
        .filter((m) => /gpt|o1|o3/.test(m.id))
        .map((m) => ({ id: m.id, name: m.id }));
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
    const openai = createOpenAI({
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
        model: openai(model),
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
