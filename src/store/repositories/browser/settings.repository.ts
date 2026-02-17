import { EntityBase } from "@/store/repository";
import { ISettingsRepository, Settings } from "../entities/settings";
import { db } from "./dexie-db";

export class SettingsRepository implements ISettingsRepository {
  async count(): Promise<number> {
    return await db.settings.count();
  }

  async getOne(id: EntityBase["id"]): Promise<Settings | null> {
    return (await db.settings.get(id)) || null;
  }

  async update(id: EntityBase["id"], item: Settings): Promise<Settings> {
    await db.settings.put(item, id);
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Settings[]> {
    let collection = db.settings.toCollection();
    if (query?.limit) {
      collection = collection.limit(query.limit);
    }
    return await collection.toArray();
  }

  async save(setting: Settings): Promise<Settings> {
    await db.settings.put(setting);
    return setting;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await db.settings.get(id);
    if (!existing) return false;
    await db.settings.delete(id);
    return true;
  }
}