import type { Tab } from "@/store/repositories/entities/tab";

export const NOTE_TAB_TYPE = "tab";
export const AI_CHAT_TAB_TYPE = "ai-chat-tab";
export const TERMINAL_TAB_TYPE = "terminal-tab";

export type TabTargetType = "note" | "ai-chat" | "terminal";

export type TabTarget = {
    type: TabTargetType;
    id: string;
};

export type TabTargetCandidate = Pick<Tab, "id" | "noteId"> & {
    type?: string | null;
};

export function isAiChatTab(tab: { type?: string | null }): boolean {
    return tab.type === AI_CHAT_TAB_TYPE;
}

export function isTerminalTab(tab: { type?: string | null }): boolean {
    return tab.type === TERMINAL_TAB_TYPE;
}

export function isNoteTab(tab: { type?: string | null }): boolean {
    return !isAiChatTab(tab) && !isTerminalTab(tab);
}

export function isNoteTabForNoteId(tab: Pick<TabTargetCandidate, "noteId" | "type">, noteId: string): boolean {
    return isNoteTab(tab) && tab.noteId === noteId;
}

export function getTabTargetType(tab: { type?: string | null }): TabTargetType {
    if (isAiChatTab(tab)) return "ai-chat";
    if (isTerminalTab(tab)) return "terminal";
    return "note";
}

export function getTabTarget(tab: Pick<TabTargetCandidate, "noteId" | "type">): TabTarget {
    return { type: getTabTargetType(tab), id: tab.noteId };
}

export function getTabTargetKey(target: TabTarget): string {
    return `${target.type}:${target.id}`;
}

export function getTabTargetKeyForTab(tab: Pick<TabTargetCandidate, "noteId" | "type">): string {
    return getTabTargetKey(getTabTarget(tab));
}

export function isSameTabTarget(a: TabTarget, b: TabTarget): boolean {
    return a.type === b.type && a.id === b.id;
}

export function getRouteForTabTarget(target: TabTarget): string {
    if (target.type === "ai-chat") {
        return `/chat?chatId=${encodeURIComponent(target.id)}`;
    }

    if (target.type === "terminal") {
        return `/terminal/${encodeURIComponent(target.id)}`;
    }

    return `/note/${target.id}`;
}

export function getRouteForTab(tab: Pick<TabTargetCandidate, "noteId" | "type">): string {
    return getRouteForTabTarget(getTabTarget(tab));
}

export function getCurrentRouteTabTarget(pathname: string, search: string): TabTarget | null {
    if (pathname.startsWith("/note/")) {
        const noteId = pathname.slice("/note/".length).split("/")[0];
        return noteId ? { type: "note", id: noteId } : null;
    }

    if (pathname.startsWith("/terminal/")) {
        const terminalSessionId = decodeURIComponent(pathname.slice("/terminal/".length).split("/")[0] ?? "");
        return terminalSessionId ? { type: "terminal", id: terminalSessionId } : null;
    }

    if (pathname === "/chat") {
        const chatId = new URLSearchParams(search).get("chatId");
        return chatId ? { type: "ai-chat", id: chatId } : null;
    }

    return null;
}

export function findTabByTarget<T extends TabTargetCandidate>(tabs: T[], target: TabTarget | null): T | null {
    if (!target) return null;
    return tabs.find((tab) => isSameTabTarget(getTabTarget(tab), target)) ?? null;
}
