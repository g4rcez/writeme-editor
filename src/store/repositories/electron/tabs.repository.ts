import { EntityBase } from "@/store/repository";
import { ITabRepository, Tab } from "../entities/tab";

export class TabsRepository implements ITabRepository {
  async count(): Promise<number> {
    return await window.electronAPI.db.count("tabs");
  }

  async getOne(id: EntityBase["id"]): Promise<Tab | null> {
    return (await window.electronAPI.db.get<Tab>("tabs", id)) || null;
  }

  async update(id: EntityBase["id"], item: Tab): Promise<Tab> {
    await window.electronAPI.db.save("tabs", { ...item, id });
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Tab[]> {
    const all = await window.electronAPI.db.getAll<Tab>("tabs");
    const sorted = all.sort((a, b) => a.order - b.order);
    if (query?.limit) {
      return sorted.slice(0, query.limit);
    }
    return sorted;
  }

  async save(tab: Tab): Promise<Tab> {
    await window.electronAPI.db.save("tabs", tab);
    return tab;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getOne(id);
    if (!existing) return false;
    await window.electronAPI.db.delete("tabs", id);
    return true;
  }

  async clear(): Promise<void> {
    const tabs = await this.getAll();
    for (const tab of tabs) {
      await this.delete(tab.id);
    }
  }

  async updateOrder(tabs: Tab[]): Promise<void> {
    await window.electronAPI.db.tabs.updateOrder(
      tabs.map((t) => ({ id: t.id, order: t.order })),
    );
  }
}