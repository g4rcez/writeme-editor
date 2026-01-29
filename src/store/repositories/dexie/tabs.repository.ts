import { db, Tab } from "./dexie-db";

export class TabsRepository {
  async getAll(project: string): Promise<Tab[]> {
    return await db.tabs
      .where("project")
      .equals(project)
      .sortBy("order");
  }

  async save(tab: Tab): Promise<void> {
    await db.tabs.put(tab);
  }

  async delete(id: string): Promise<void> {
    await db.tabs.delete(id);
  }

  async clear(project: string): Promise<void> {
    await db.tabs.where("project").equals(project).delete();
  }

  async updateOrder(tabs: Tab[]): Promise<void> {
    await db.transaction("rw", db.tabs, async () => {
      for (const tab of tabs) {
        await db.tabs.update(tab.id, { order: tab.order });
      }
    });
  }
}
