import { EntityBase } from "@/store/repository";
import { db } from "./dexie-db";
import { ITabRepository, Tab } from "../entities/tab";

export class TabsRepository implements ITabRepository {
  async count(): Promise<number> {
    return await db.tabs.count();
  }

  async getOne(id: EntityBase["id"]): Promise<Tab | null> {
    return (await db.tabs.get(id)) || null;
  }

  async update(id: EntityBase["id"], item: Tab): Promise<Tab> {
    await db.tabs.put(item, id);
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Tab[]> {
    let collection = db.tabs.orderBy("order");
    if (query?.limit) {
      collection = collection.limit(query.limit);
    }
    return await collection.toArray();
  }

  async save(tab: Tab): Promise<Tab> {
    await db.tabs.put(tab, tab.id);
    return tab;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await db.tabs.get(id);
    if (!existing) return false;
    await db.tabs.delete(id);
    return true;
  }

  async clear(): Promise<void> {
    await db.tabs.clear();
  }

  async updateOrder(tabs: Tab[]): Promise<void> {
    await db.transaction("rw", db.tabs, async () => {
      for (const tab of tabs) {
        await db.tabs.update(tab.id, { order: tab.order });
      }
    });
  }
}