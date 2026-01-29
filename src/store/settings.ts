export interface AppSettings {
  storageDirectory: string | null;
  defaultAuthor: string;
  autoSyncInterval: number;
  conflictResolution: "ask" | "file-wins" | "editor-wins";
  theme: "light" | "dark";
  currency: {
    cacheDuration: number;
    preferredAPI: "exchangerate-api" | "frankfurter";
    apiKey?: string;
  };
}

export class SettingsRepository {
  private static STORAGE_KEY = "WRITEME_SETTINGS";

  static load(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...this.defaults(), ...parsed };
      } catch (error) {
        console.error("Failed to parse settings:", error);
        return this.defaults();
      }
    }
    return this.defaults();
  }

  /**
   * Save partial settings update
   * Merges with existing settings and persists to localStorage
   */
  static save(settings: Partial<AppSettings>): AppSettings {
    const current = this.load();
    const updated = { ...current, ...settings };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }

  /**
   * Reset settings to defaults
   */
  static reset(): AppSettings {
    const defaults = this.defaults();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  /**
   * Default settings
   */
  static defaults(): AppSettings {
    return {
      storageDirectory: null,
      defaultAuthor: "user",
      autoSyncInterval: 5000, // 5 seconds
      conflictResolution: "ask",
      theme: "dark",
      currency: {
        cacheDuration: 60 * 60 * 1000, // 1 hour
        preferredAPI: "frankfurter",
      },
    };
  }
}
