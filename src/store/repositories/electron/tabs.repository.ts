import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import { BaseRepository } from "../base.repository";
import { type ITabRepository, type Tab } from "../entities/tab";

export class TabsRepository extends BaseRepository<Tab> implements ITabRepository {
    constructor() {
        super(new ElectronStorageAdapter(), "tabs", (a, b) => a.order - b.order);
    }

    async clear(): Promise<void> {
        const tabs = await this.getAll();
        for (const tab of tabs) {
            await this.delete(tab.id);
        }
    }

    async updateOrder(tabs: Tab[]): Promise<void> {
        await window.electronAPI.db.tabs.updateOrder(tabs.map((t) => ({ id: t.id, order: t.order })));
    }

    async deleteByNoteId(noteId: string): Promise<void> {
        await window.electronAPI.db.tabs.deleteByNoteId(noteId);
    }
}
