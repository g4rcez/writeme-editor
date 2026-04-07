import { isElectron } from "@/lib/is-electron";
import type {
  AIAdapter,
  AIConversationMessage,
  AIFile,
  AIModel,
  AIStreamEvent,
  AuthCredentials,
  SendOptions,
} from "./types";

export class CLIAdapter implements AIAdapter {
  readonly id = "cli";
  readonly name = "CLI (Local)";
  readonly supportsFiles = false;
  readonly supportsOAuth = false;
  readonly defaultModel = "";

  constructor() {
    if (!isElectron()) {
      throw new Error("CLIAdapter can only be used in Electron");
    }
  }

  async auth(_method: "oauth" | "api-key", _apiKey?: string): Promise<AuthCredentials> {
    return {};
  }

  async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
    return credentials;
  }

  isExpired(_credentials: AuthCredentials): boolean {
    return false;
  }

  async listModels(_credentials: AuthCredentials): Promise<AIModel[]> {
    return [];
  }

  async prepareFile(_file: File): Promise<AIFile> {
    throw new Error("CLI adapter does not support file attachments");
  }

  async *sendMessage(
    messages: AIConversationMessage[],
    options: SendOptions,
    signal?: AbortSignal,
  ): AsyncIterable<AIStreamEvent> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const prompt = lastUserMsg?.content.text ?? "";

    const commandTemplate = (options as any).commandTemplate ?? "";

    window.electronAPI.ai.query({
      commandTemplate,
      prompt,
      selection: "",
      context: "",
      systemPrompt: options.systemPrompt ?? "",
    });

    yield* this._streamFromIPC(signal);
  }

  private _streamFromIPC(signal?: AbortSignal): AsyncIterable<AIStreamEvent> {
    return {
      [Symbol.asyncIterator]() {
        const queue: AIStreamEvent[] = [];
        let resolve: (() => void) | null = null;
        let done = false;

        const push = (event: AIStreamEvent) => {
          queue.push(event);
          resolve?.();
          resolve = null;
        };

        const unChunk = window.electronAPI.ai.onChunk(({ chunk }) => {
          push({ type: "text", delta: chunk });
        });

        const unDone = window.electronAPI.ai.onDone(() => {
          done = true;
          push({ type: "done" });
          cleanup();
        });

        const unError = window.electronAPI.ai.onError(({ error }) => {
          done = true;
          push({ type: "error", message: error });
          cleanup();
        });

        const cleanup = () => {
          unChunk();
          unDone();
          unError();
        };

        if (signal) {
          signal.addEventListener("abort", () => {
            window.electronAPI.ai.stop();
            done = true;
            resolve?.();
            resolve = null;
            cleanup();
          });
        }

        return {
          async next(): Promise<IteratorResult<AIStreamEvent>> {
            while (queue.length === 0 && !done) {
              await new Promise<void>((res) => {
                resolve = res;
              });
            }
            if (queue.length > 0) {
              return { value: queue.shift()!, done: false };
            }
            return { value: undefined as any, done: true };
          },
          return() {
            cleanup();
            return Promise.resolve({ value: undefined as any, done: true });
          },
        };
      },
    };
  }
}
