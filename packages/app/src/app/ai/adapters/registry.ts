import type { AIAdapter } from "./types";

class AdapterRegistry {
  private adapters = new Map<string, AIAdapter>();

  register(adapter: AIAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): AIAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): AIAdapter[] {
    return Array.from(this.adapters.values());
  }

  getDefault(): AIAdapter | undefined {
    return this.adapters.values().next().value;
  }
}

export const adapterRegistry = new AdapterRegistry();
