import type { Tab } from "@/store/repositories/entities/tab";

export type TabCycleDirection = "forward" | "backward";

type TabCycleCandidate = Pick<Tab, "id" | "noteId" | "order">;

type GetCycledTabNoteIdOptions = {
  tabs: TabCycleCandidate[];
  currentNoteId: string | null;
  activeTabId: string | null;
  direction: TabCycleDirection;
};

export function getCycledTabNoteId({
  tabs,
  currentNoteId,
  activeTabId,
  direction,
}: GetCycledTabNoteIdOptions): string | null {
  if (tabs.length < 2) return null;
  const orderedTabs = tabs.toSorted((a, b) => a.order - b.order);
  const routeIndex = currentNoteId
    ? orderedTabs.findIndex((tab) => tab.noteId === currentNoteId)
    : -1;
  const activeIndex = activeTabId
    ? orderedTabs.findIndex(
        (tab) => tab.id === activeTabId || tab.noteId === activeTabId,
      )
    : -1;
  const currentIndex = routeIndex === -1 ? activeIndex : routeIndex;
  if (currentIndex === -1) return null;
  const step = direction === "forward" ? 1 : -1;
  const nextIndex =
    (currentIndex + step + orderedTabs.length) % orderedTabs.length;
  return orderedTabs[nextIndex]?.noteId ?? null;
}
