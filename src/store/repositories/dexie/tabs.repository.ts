import { db, Tab } from "./dexie-db";

export class TabsRepository {
  async getAll(): Promise<Tab[]> {
    return await db.tabs.orderBy("order").toArray();
  }

  async save(tab: Tab): Promise<void> {
    await db.tabs.put(tab, tab.id);
  }

  async delete(id: string): Promise<void> {
    await db.tabs.delete(id);
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
