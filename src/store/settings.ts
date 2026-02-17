import { AppSettings, SettingsSchema } from "./settings.schema";
import { repositories } from "./repositories";

export type { AppSettings };

export class SettingsRepository {
  private static cache: AppSettings = SettingsSchema.parse({});
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const settings = await repositories.settings.getAll();
      const settingsMap: Record<string, any> = {};

      settings.forEach((s) => {
        try {
          settingsMap[s.name] = JSON.parse(s.value);
        } catch (e) {
          console.warn(`Failed to parse setting ${s.name}:`, e);
          settingsMap[s.name] = s.value; // Fallback
        }
      });
      this.cache = SettingsSchema.parse(settingsMap);
      this.initialized = true;
    } catch (error) {
      console.error("Failed to load settings from DB:", error);
    }
  }

  static load(): AppSettings {
    if (!this.initialized) {
      console.warn(
        "SettingsRepository.load() called before init(). Returning defaults.",
      );
    }
    return { ...this.cache };
  }

  static async save(settings: Partial<AppSettings>): Promise<AppSettings> {
    const updated = SettingsSchema.parse({ ...this.cache, ...settings });
    this.cache = updated;
    const promises = Object.entries(settings).map(([key, value]) =>
      this.persistSetting(key, value),
    );
    await Promise.all(promises);
    return updated;
  }

  private static async persistSetting(name: string, value: any): Promise<void> {
    const stringValue = JSON.stringify(value);

    // Find existing to get ID
    const all = await repositories.settings.getAll();
    const existing = all.find((s) => s.name === name);

    const id = existing ? existing.id : crypto.randomUUID();

    await repositories.settings.save({
      id,
      name,
      value: stringValue,
    });
  }

  static get(): AppSettings {
    return this.load();
  }
}
