import { AppSettings, SettingsSchema } from "./settings.schema";
import { isElectron } from "../lib/is-electron";
import { SettingsRepository as BrowserSettingsRepository } from "./repositories/browser/settings.repository";
import { SettingsRepository as ElectronSettingsRepository } from "./repositories/electron/settings.repository";
import { ISettingsRepository } from "./repositories/entities/settings";

export type { AppSettings };

export class SettingsService {
  private static cache: AppSettings = SettingsSchema.parse({});
  private static initialized = false;
  private static _repo: ISettingsRepository | null = null;

  private static get repo(): ISettingsRepository {
    if (!this._repo) {
      this._repo = isElectron()
        ? new ElectronSettingsRepository()
        : new BrowserSettingsRepository();
    }
    return this._repo;
  }

  static async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const settings = await this.repo.getAll();
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
        "SettingsService.load() called before init(). Returning defaults.",
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
    const all = await this.repo.getAll();
    const existing = all.find((s) => s.name === name);
    const id = existing ? existing.id : crypto.randomUUID();
    const now = new Date();
    await this.repo.save({
      id,
      name,
      value: stringValue,
      type: existing?.type || "setting",
      updatedAt: now,
      createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
    } as any);
  }

  static get(): AppSettings {
    return this.load();
  }
}
