import { EntityBase } from "@/store/repository";
import { ISettingsRepository, Settings } from "../entities/settings";

export class SettingsRepository implements ISettingsRepository {
  async count(): Promise<number> {
    return await window.electronAPI.db.count("settings");
  }

  async getOne(id: EntityBase["id"]): Promise<Settings | null> {
    return (await window.electronAPI.db.get<Settings>("settings", id)) || null;
  }

  async update(id: EntityBase["id"], item: Settings): Promise<Settings> {
    await window.electronAPI.db.save("settings", { ...item, id });
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Settings[]> {
    const all = await window.electronAPI.db.getAll<Settings>("settings");
    if (query?.limit) {
      return all.slice(0, query.limit);
    }
    return all;
  }

  async save(setting: Settings): Promise<Settings> {
    await window.electronAPI.db.save("settings", setting);
    return setting;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getOne(id);
    if (!existing) return false;
    await window.electronAPI.db.delete("settings", id);
    return true;
  }
}