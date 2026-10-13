import type { Tab } from "@/store/repositories/entities/tab";

export const MAX_RECENTLY_CLOSED_TABS = 3;

const recentlyClosedTabs: Tab[] = [];

export function rememberClosedTab(tab: Tab): void {
    recentlyClosedTabs.unshift({ ...tab });
    recentlyClosedTabs.length = Math.min(recentlyClosedTabs.length, MAX_RECENTLY_CLOSED_TABS);
}

export function takeRecentlyClosedTab(): Tab | null {
    return recentlyClosedTabs.shift() ?? null;
}

export function clearRecentlyClosedTabs(): void {
    recentlyClosedTabs.length = 0;
}
