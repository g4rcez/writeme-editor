import { isElectron } from "@/lib/is-electron";
import { AnthropicAdapter } from "./adapters/anthropic.adapter";
import { GeminiAdapter } from "./adapters/gemini.adapter";
import { OllamaAdapter } from "./adapters/ollama.adapter";
import { OpenAIAdapter } from "./adapters/openai.adapter";
import { adapterRegistry } from "./adapters/registry";

export function setupAIAdapters(): void {
  adapterRegistry.register(new AnthropicAdapter());
  adapterRegistry.register(new OpenAIAdapter());
  adapterRegistry.register(new GeminiAdapter());
  adapterRegistry.register(new OllamaAdapter());
  if (isElectron()) {
    import("./adapters/cli.adapter")
      .then(({ CLIAdapter }) => adapterRegistry.register(new CLIAdapter()))
      .catch(() => {});
  }
}
