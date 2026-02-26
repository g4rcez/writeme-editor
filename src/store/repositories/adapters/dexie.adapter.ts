import { type StorageAdapter } from "./types";
import { db } from "../browser/dexie-db";

export class DexieStorageAdapter implements StorageAdapter {
  async count(collection: string): Promise<number> {
    return await db.table(collection).count();
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    return (await db.table(collection).get(id)) || null;
  }

  async getAll<T>(
    collection: string,
    query?: { limit?: number },
  ): Promise<T[]> {
    let dexieCollection = db.table(collection).toCollection();
    if (query?.limit) {
      dexieCollection = dexieCollection.limit(query.limit);
    }
    return await dexieCollection.toArray();
  }

  async save<T>(collection: string, item: T): Promise<T> {
    await db.table(collection).put(item);
    return item;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const table = db.table(collection);
    const existing = await table.get(id);
    if (!existing) return false;
    await table.delete(id);
    return true;
  }
}
