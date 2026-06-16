import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMINAL_TAB_TYPE } from "@/lib/tab-target";
import type { Tab } from "@/store/repositories/entities/tab";
import type { TerminalSession } from "@/store/repositories/entities/terminal-session";
import { TerminalWorkspace } from "./terminal-workspace";

vi.mock("./terminal-panel", () => ({
	TerminalPanel: ({
		active,
		cwd,
		sessionId,
		showRestartNotice,
	}: {
		active: boolean;
		cwd: string | null;
		sessionId: string;
		showRestartNotice: boolean;
	}) => (
		<div
			data-testid={`terminal-panel-${sessionId}`}
			data-active={String(active)}
			data-cwd={cwd ?? ""}
			data-restart-notice={String(showRestartNotice)}
		/>
	),
}));

const createTab = (
	overrides: Partial<Tab> & Pick<Tab, "id" | "noteId">,
): Tab => ({
	type: "tab",
	order: 0,
	project: "workspace-a",
	createdAt: new Date("2024-01-01T00:00:00.000Z"),
	updatedAt: new Date("2024-01-01T00:00:00.000Z"),
	scrollY: 0,
	...overrides,
});

const createTerminalSession = (id: string): TerminalSession => ({
	id,
	title: "Terminal",
	project: "workspace-a",
	type: "terminal-session",
	createdAt: new Date("2024-01-01T00:00:00.000Z"),
	updatedAt: new Date("2024-01-01T00:00:00.000Z"),
});

function createDispatch() {
	return {
		ensureTerminalSession: vi.fn(),
	};
}

describe("TerminalWorkspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders every open terminal panel so inactive sessions stay mounted", () => {
		render(
			<TerminalWorkspace
				tabs={[
					createTab({ id: "note-tab", noteId: "note-1", order: 0 }),
					createTab({
						id: "terminal-tab-1",
						noteId: "terminal-1",
						order: 1,
						type: TERMINAL_TAB_TYPE,
					}),
					createTab({
						id: "terminal-tab-2",
						noteId: "terminal-2",
						order: 2,
						type: TERMINAL_TAB_TYPE,
					}),
				]}
				terminalSessions={[
					createTerminalSession("terminal-1"),
					createTerminalSession("terminal-2"),
				]}
				restoredTerminalSessionIds={["terminal-2"]}
				activeSessionId="terminal-1"
				directory="/workspace"
				dispatch={createDispatch() as never}
			/>,
		);

		expect(screen.getByTestId("terminal-panel-terminal-1")).toHaveAttribute(
			"data-active",
			"true",
		);
		expect(screen.getByTestId("terminal-panel-terminal-2")).toHaveAttribute(
			"data-active",
			"false",
		);
		expect(screen.getByTestId("terminal-panel-terminal-1")).toHaveAttribute(
			"data-cwd",
			"/workspace",
		);
		expect(screen.getByTestId("terminal-panel-terminal-2")).toHaveAttribute(
			"data-restart-notice",
			"true",
		);
	});

	it("repairs missing terminal session metadata for restored terminal tabs", async () => {
		const dispatch = createDispatch();

		render(
			<TerminalWorkspace
				tabs={[
					createTab({
						id: "terminal-tab",
						noteId: "missing-terminal",
						type: TERMINAL_TAB_TYPE,
					}),
				]}
				terminalSessions={[]}
				restoredTerminalSessionIds={[]}
				activeSessionId="missing-terminal"
				directory={null}
				dispatch={dispatch as never}
			/>,
		);

		await waitFor(() => {
			expect(dispatch.ensureTerminalSession).toHaveBeenCalledWith(
				"missing-terminal",
			);
		});
	});
});
