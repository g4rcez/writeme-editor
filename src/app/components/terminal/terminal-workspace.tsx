import { css } from "@g4rcez/components";
import { useEffect, useMemo } from "react";
import { isTerminalTab } from "@/lib/tab-target";
import type { GlobalDispatchers } from "@/store/global.store";
import type { Tab } from "@/store/repositories/entities/tab";
import type { TerminalSession } from "@/store/repositories/entities/terminal-session";
import { TerminalPanel } from "./terminal-panel";

type TerminalWorkspaceProps = {
	tabs: Tab[];
	terminalSessions: TerminalSession[];
	restoredTerminalSessionIds: string[];
	activeSessionId: string | null;
	directory: string | null;
	dispatch: GlobalDispatchers;
	className?: string;
};

export function TerminalWorkspace({
	tabs,
	terminalSessions,
	restoredTerminalSessionIds,
	activeSessionId,
	directory,
	dispatch,
	className,
}: TerminalWorkspaceProps) {
	const terminalTabs = useMemo(
		() => tabs.filter(isTerminalTab).toSorted((a, b) => a.order - b.order),
		[tabs],
	);
	const knownSessionIds = useMemo(
		() => new Set(terminalSessions.map((session) => session.id)),
		[terminalSessions],
	);
	const restoredSessionIds = useMemo(
		() => new Set(restoredTerminalSessionIds),
		[restoredTerminalSessionIds],
	);

	useEffect(() => {
		for (const tab of terminalTabs) {
			if (!knownSessionIds.has(tab.noteId)) {
				void dispatch.ensureTerminalSession(tab.noteId);
			}
		}
	}, [dispatch, knownSessionIds, terminalTabs]);

	return (
		<div className={css("h-full min-h-0 w-full bg-[#1e1e1e]", className)}>
			{terminalTabs.map((tab) => {
				const active = activeSessionId === tab.noteId;
				return (
					<div
						key={tab.noteId}
						aria-hidden={!active}
						className={css(
							"h-full min-h-0 w-full",
							active ? "block" : "hidden",
						)}
					>
						<TerminalPanel
							sessionId={tab.noteId}
							active={active}
							cwd={directory}
							showRestartNotice={restoredSessionIds.has(tab.noteId)}
						/>
					</div>
				);
			})}
		</div>
	);
}
