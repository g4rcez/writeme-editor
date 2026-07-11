import type { DatabaseCollection } from "../../../main-process/database-schema";
import { type StorageAdapter } from "./types";

export class ElectronStorageAdapter implements StorageAdapter {
  async count(collection: string): Promise<number> {
    return await window.electronAPI.db.count(collection as DatabaseCollection);
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    return (
      (await window.electronAPI.db.get<T>(
        collection as DatabaseCollection,
        id,
      )) || null
    );
  }

  async getAll<T>(
    collection: string,
    query?: { limit?: number },
  ): Promise<T[]> {
    const all = await window.electronAPI.db.getAll<T>(
      collection as DatabaseCollection,
    );
    if (query?.limit) {
      return all.slice(0, query.limit);
    }
    return all;
  }

  async save<T>(collection: string, item: T): Promise<T> {
    const id = (item as any).id;
    await window.electronAPI.db.save(collection as DatabaseCollection, {
      ...item,
      id,
    });
    return item;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const existing = await this.get(collection, id);
    if (!existing) return false;
    await window.electronAPI.db.delete(collection as DatabaseCollection, id);
    return true;
  }
}
