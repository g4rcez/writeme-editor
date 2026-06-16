import type { Tab } from "@/store/repositories/entities/tab";

type TabCloseCandidate = Pick<Tab, "id">;

export function getPreviousTabAfterClose<T extends TabCloseCandidate>(
  tabs: T[],
  closingTabId: string,
): T | null {
  const closingIndex = tabs.findIndex((tab) => tab.id === closingTabId);
  if (closingIndex === -1) return null;

  const remainingTabs = tabs.filter((tab) => tab.id !== closingTabId);
  return remainingTabs[closingIndex - 1] ?? remainingTabs[closingIndex] ?? null;
}
