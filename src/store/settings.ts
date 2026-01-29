/**
 * Application settings stored in localStorage
 */
export interface AppSettings {
  /** User-chosen root directory for storing markdown files */
  storageDirectory: string | null;

  /** Default author name for createdBy/updatedBy fields */
  defaultAuthor: string;

  /** Interval in milliseconds for checking file sync (future feature) */
  autoSyncInterval: number;

  /** How to handle conflicts when file changed externally */
  conflictResolution: "ask" | "file-wins" | "editor-wins";

  /** Theme preference (light/dark) */
  theme: "light" | "dark";

  /** Currency conversion settings */
  currency: {
    /** Cache duration in milliseconds (default: 3600000 = 1 hour) */
    cacheDuration: number;
    /** Preferred API ('exchangerate-api' | 'frankfurter') */
    preferredAPI: "exchangerate-api" | "frankfurter";
    /** Optional API key for premium tier */
    apiKey?: string;
  };
}

/**
 * Repository for managing application settings
 * Stores settings in localStorage for persistence across sessions
 */
export class SettingsRepository {
  private static STORAGE_KEY = "WRITEME_SETTINGS";

  /**
   * Load settings from localStorage
   * Returns defaults if no settings exist
   */
  static load(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings added in updates
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
