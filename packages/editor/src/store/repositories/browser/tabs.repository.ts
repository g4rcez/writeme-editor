import { isNoteTabForNoteId } from "@/lib/tab-target";
import type { ITabRepository, Tab } from "../entities/tab";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { BaseRepository } from "../base.repository";
import { db } from "./dexie-db";

export class TabsRepository extends BaseRepository<Tab> implements ITabRepository {
    constructor() {
        super(new DexieStorageAdapter(), "tabs", (a, b) => a.order - b.order);
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

    async deleteByNoteId(noteId: string): Promise<void> {
        const tabs = await db.tabs.where("noteId").equals(noteId).toArray();
        const noteTabIds = tabs.filter((tab) => isNoteTabForNoteId(tab, noteId)).map((tab) => tab.id);
        await db.tabs.bulkDelete(noteTabIds);
    }
}
