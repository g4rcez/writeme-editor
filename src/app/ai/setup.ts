import { isElectron } from "@/lib/is-electron";
import { AnthropicAdapter } from "./adapters/anthropic.adapter";
import { GeminiAdapter } from "./adapters/gemini.adapter";
import { OpenAIAdapter } from "./adapters/openai.adapter";
import { adapterRegistry } from "./adapters/registry";

export function setupAIAdapters(): void {
  adapterRegistry.register(new AnthropicAdapter());
  adapterRegistry.register(new OpenAIAdapter());
  adapterRegistry.register(new GeminiAdapter());
  if (isElectron()) {
    // Dynamic import to avoid loading Electron-only code in browser build
    import("./adapters/cli.adapter").then(({ CLIAdapter }) => {
      adapterRegistry.register(new CLIAdapter());
    }).catch(() => {});
  }
}
