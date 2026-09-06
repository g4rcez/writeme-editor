import { v7 as uuid } from "uuid";
import type { ISettingsRepository } from "./repositories/entities/settings";
import { isElectron } from "../lib/is-electron";
import { DexieStorageAdapter } from "./repositories/adapters/dexie.adapter";
import { ElectronStorageAdapter } from "./repositories/adapters/electron.adapter";
import { SettingsRepository } from "./repositories/shared/settings.repository";
import { type AppSettings, SettingsSchema } from "./settings.schema";

export type { AppSettings };
export type EditorMode = AppSettings["editorMode"];

export class SettingsService {
    private static cache: AppSettings = SettingsSchema.parse({});
    private static initialized = false;
    private static _repo: ISettingsRepository | null = null;

    private static get repo(): ISettingsRepository {
        if (!SettingsService._repo) {
            SettingsService._repo = new SettingsRepository(
                isElectron() ? new ElectronStorageAdapter() : new DexieStorageAdapter(),
            );
        }
        return SettingsService._repo;
    }

    static async init(): Promise<void> {
        if (SettingsService.initialized) return;
        try {
            const settings = await SettingsService.repo.getAll();
            const settingsMap: Record<string, any> = {};
            settings.forEach((s) => {
                try {
                    settingsMap[s.name] = JSON.parse(s.value);
                } catch (e) {
                    console.warn(`Failed to parse setting ${s.name}:`, e);
                    settingsMap[s.name] = s.value; // Fallback
                }
            });
            if (settingsMap.editorMode === "rich") settingsMap.editorMode = "formatted";
            if (settingsMap.editorMode === "raw") settingsMap.editorMode = "markdown";
            SettingsService.cache = SettingsSchema.parse(settingsMap);
            SettingsService.initialized = true;
        } catch (error) {
            console.error("Failed to load settings from DB:", error);
        }
    }

    static load(): AppSettings {
        if (!SettingsService.initialized) {
            console.warn("SettingsService.load() called before init(). Returning defaults.");
        }
        return { ...SettingsService.cache };
    }

    static async save(settings: Partial<AppSettings>): Promise<AppSettings> {
        const updated = SettingsSchema.parse({ ...SettingsService.cache, ...settings });
        SettingsService.cache = updated;
        const promises = Object.entries(settings).map(([key, value]) => SettingsService.persistSetting(key, value));
        await Promise.all(promises);
        return updated;
    }

    private static async persistSetting(name: string, value: any): Promise<void> {
        const stringValue = JSON.stringify(value);
        const all = await SettingsService.repo.getAll();
        const existing = all.find((s) => s.name === name);
        const id = existing ? existing.id : uuid();
        const now = new Date();
        await SettingsService.repo.save({
            id,
            name,
            value: stringValue,
            type: existing?.type || "setting",
            updatedAt: now,
            createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
        } as any);
    }

    static get(): AppSettings {
        return SettingsService.load();
    }
}
