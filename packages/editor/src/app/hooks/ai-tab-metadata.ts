import type { AIChat } from "@/store/repositories/electron/ai.repository";
import { AI_CHATS_CHANGED_EVENT } from "@/app/ai/events";
import { repositories } from "@/store/repositories";

type Listener = (chats: AIChat[]) => void;
type Entry = {
    chats: AIChat[];
    listeners: Set<Listener>;
    version: number;
    refresh: () => void;
};
const entries = new Map<string, Entry>();

export function subscribeAiTabMetadata(scope: string, chatIdsKey: string, listener: Listener): () => void {
    const key = JSON.stringify([scope, chatIdsKey]);
    let entry = entries.get(key);
    let created = false;
    if (!entry) {
        const resource: Entry = {
            chats: [],
            listeners: new Set(),
            version: 0,
            refresh: () => {
                const version = ++resource.version;
                const current = (): boolean => entries.get(key) === resource && resource.version === version;
                void Promise.resolve().then(async () => {
                    if (!current()) return;
                    try {
                        const chats = await repositories.ai.getChats(scope);
                        if (!current()) return;
                        resource.chats = chats;
                        for (const subscriber of resource.listeners) subscriber(chats);
                    } catch (error) {
                        if (current()) console.error("Failed to load AI tab metadata:", error);
                    }
                });
            },
        };
        entry = resource;
        entries.set(key, entry);
        window.addEventListener(AI_CHATS_CHANGED_EVENT, entry.refresh);
        created = true;
    }
    const resource = entry;
    resource.listeners.add(listener);
    listener(resource.chats);
    if (created) resource.refresh();
    return () => {
        resource.listeners.delete(listener);
        if (resource.listeners.size > 0) return;
        resource.version += 1;
        window.removeEventListener(AI_CHATS_CHANGED_EVENT, resource.refresh);
        if (entries.get(key) === resource) entries.delete(key);
    };
}
