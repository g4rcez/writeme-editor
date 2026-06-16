import type { Tab } from "@/store/repositories/entities/tab";
import {
	getTabTarget,
	getTabTargetKey,
	isNoteTab,
	type TabTarget,
} from "./tab-target";

export type TabCycleDirection = "forward" | "backward";

type TabCycleCandidate = Pick<Tab, "id" | "noteId" | "order"> & {
	type?: string | null;
};

type GetCycledTabTargetOptions = {
	tabs: TabCycleCandidate[];
	currentTarget: TabTarget | null;
	activeTabId: string | null;
	direction: TabCycleDirection;
};

type GetCycledTabNoteIdOptions = {
	tabs: TabCycleCandidate[];
	currentNoteId: string | null;
	activeTabId: string | null;
	direction: TabCycleDirection;
};

function getCurrentTabIndex(
	orderedTabs: TabCycleCandidate[],
	currentTarget: TabTarget | null,
	activeTabId: string | null,
): number {
	const currentTargetKey = currentTarget
		? getTabTargetKey(currentTarget)
		: null;
	const routeIndex = currentTargetKey
		? orderedTabs.findIndex(
				(tab) => getTabTargetKey(getTabTarget(tab)) === currentTargetKey,
			)
		: -1;
	if (routeIndex !== -1) return routeIndex;

	if (!activeTabId) return -1;
	return orderedTabs.findIndex(
		(tab) =>
			tab.id === activeTabId || (isNoteTab(tab) && tab.noteId === activeTabId),
	);
}

export function getCycledTabTarget({
	tabs,
	currentTarget,
	activeTabId,
	direction,
}: GetCycledTabTargetOptions): TabTarget | null {
	if (tabs.length < 2) return null;
	const orderedTabs = tabs.toSorted((a, b) => a.order - b.order);
	const currentIndex = getCurrentTabIndex(
		orderedTabs,
		currentTarget,
		activeTabId,
	);
	if (currentIndex === -1) return null;

	const step = direction === "forward" ? 1 : -1;
	const nextIndex =
		(currentIndex + step + orderedTabs.length) % orderedTabs.length;
	const nextTab = orderedTabs[nextIndex];
	return nextTab ? getTabTarget(nextTab) : null;
}

export function getCycledTabNoteId({
	tabs,
	currentNoteId,
	activeTabId,
	direction,
}: GetCycledTabNoteIdOptions): string | null {
	const target = getCycledTabTarget({
		tabs,
		currentTarget: currentNoteId ? { type: "note", id: currentNoteId } : null,
		activeTabId,
		direction,
	});

	return target?.type === "note" ? target.id : null;
}
