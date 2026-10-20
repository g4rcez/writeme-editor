import { useEffect, useMemo, useState } from "react";
import type { AIChat } from "@/store/repositories/electron/ai.repository";
import type { Tab } from "@/store/repositories/entities/tab";
import { getWorkspaceChatScope } from "@/app/ai/workspace-context";
import { supportsAI } from "@/lib/platform";
import { isAiChatTab } from "@/lib/tab-target";
import { subscribeAiTabMetadata } from "./ai-tab-metadata";

type Snapshot = { key: string; chats: AIChat[] };

export function useAiChatTabs(directory: string | null, tabs: Tab[]): Map<string, AIChat> {
    const enabled = supportsAI();
    const scope = enabled ? getWorkspaceChatScope(directory) : "";
    const chatIdsKey = JSON.stringify([...new Set(tabs.filter(isAiChatTab).map((tab) => tab.noteId))].sort());
    const key = JSON.stringify([scope, chatIdsKey]);
    const [snapshot, setSnapshot] = useState<Snapshot>({ key: "", chats: [] });

    useEffect(() => {
        if (!enabled || chatIdsKey === "[]") return;
        let current = true;
        const unsubscribe = subscribeAiTabMetadata(scope, chatIdsKey, (chats) => {
            if (current) setSnapshot({ key, chats });
        });
        return () => {
            current = false;
            unsubscribe();
        };
    }, [enabled, scope, chatIdsKey, key]);

    return useMemo(() => {
        if (!enabled || snapshot.key !== key) return new Map<string, AIChat>();
        const ids = new Set(tabs.filter(isAiChatTab).map((tab) => tab.noteId));
        return new Map(snapshot.chats.filter((chat) => ids.has(chat.id)).map((chat) => [chat.id, chat]));
    }, [enabled, snapshot, key, tabs]);
}
