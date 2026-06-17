import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMINAL_TAB_TYPE } from "@/lib/tab-target";
import type { Tab } from "@/store/repositories/entities/tab";
import type { TerminalSession } from "@/store/repositories/entities/terminal-session";
import { uiDispatch } from "@/store/ui.store";
import { Commander } from "./commander";

const mocks = vi.hoisted(() => {
	const state = {
		commander: { enabled: true, type: "all" },
		note: null,
		noteGroups: [],
		notes: [],
		tabs: [],
		terminalSessions: [],
		theme: "dark",
	};
	const dispatch = {
		addTerminalTab: vi.fn(),
		clearTabs: vi.fn(),
		commander: vi.fn(),
		directoryBrowserDialog: vi.fn(),
		loadGroups: vi.fn(),
		recentNotesDialog: vi.fn(),
		setAiDrawer: vi.fn(),
		setCreateNoteDialog: vi.fn(),
		setInspectJsonDialog: vi.fn(),
		removeTab: vi.fn(),
		setNote: vi.fn(),
		theme: vi.fn(),
	};

	return {
		commandPalette: vi.fn(() => null),
		dispatch,
		layoutDispatch: {
			setActivity: vi.fn(),
		},
		navigate: vi.fn(),
		settingsLoad: vi.fn(() => ({ directory: null })),
		state,
	};
});

type CommandItem = {
	title?: string;
	shortcut?: string;
	items?: CommandItem[];
	action?: (args: { setOpen: (value: boolean) => void }) => void;
};

type ConfirmState = {
	title: string;
	message: string;
	onConfirm: () => void;
};

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

const createTerminalSession = (
	overrides: Partial<TerminalSession> & Pick<TerminalSession, "id" | "title">,
): TerminalSession => ({
	type: "terminal-session",
	project: "workspace-a",
	createdAt: new Date("2024-01-01T00:00:00.000Z"),
	updatedAt: new Date("2024-01-01T00:00:00.000Z"),
	...overrides,
});

vi.mock("@g4rcez/components", () => ({
	CommandPalette: mocks.commandPalette,
	uuid: vi.fn(() => "terminal-session-id"),
}));

vi.mock("react-router-dom", async () => {
	const actual =
		await vi.importActual<typeof import("react-router-dom")>(
			"react-router-dom",
		);

	return {
		...actual,
		useNavigate: () => mocks.navigate,
	};
});

vi.mock("@/app/hooks/use-templates", () => ({
	useTemplates: () => ({ templates: [] }),
}));

vi.mock("@/app/contexts/layout-context", () => ({
	useLayoutStore: () => [{}, mocks.layoutDispatch],
}));

vi.mock("@/app/editor-global-ref", () => ({
	editorGlobalRef: { current: null },
}));

vi.mock("@/app/notification-ref", () => ({
	notificationRef: { current: null },
}));

vi.mock("@/lib/editor-storage", () => ({
	getEditorMarkdown: vi.fn(() => ""),
}));

vi.mock("@/lib/encoding", () => ({
	utf8ToBase64: vi.fn(() => ""),
}));

vi.mock("@/lib/is-electron", () => ({
	isElectron: vi.fn(() => true),
}));

vi.mock("@/lib/print-document", () => ({
	printDocument: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
	CommanderType: {
		All: "all",
		Notes: "Notes",
		OpenTabs: "OpenTabs",
	},
	getWorkspaceKey: (directory: string | null) => directory ?? "__local__",
	globalState: () => mocks.state,
	useGlobalStore: () => [mocks.state, mocks.dispatch],
}));

vi.mock("@/store/repositories", () => ({
	repositories: {
		notes: {
			getAll: vi.fn(),
			save: vi.fn(),
			update: vi.fn(),
		},
	},
}));

vi.mock("@/store/settings", () => ({
	SettingsService: {
		load: mocks.settingsLoad,
	},
}));

vi.mock("@/store/ui.store", () => ({
	uiDispatch: {
		openGitDialog: vi.fn(),
		openTasksDialog: vi.fn(),
		setError: vi.fn(),
		setSidebarOpen: vi.fn(),
		setConfirm: vi.fn(),
		clearConfirm: vi.fn(),
	},
}));

function getFlattenedCommands(): CommandItem[] {
	const calls = mocks.commandPalette.mock.calls as unknown[][];
	const props = calls.at(-1)?.[0] as { commands: CommandItem[] } | undefined;

	return (props?.commands ?? []).flatMap((item) => item.items ?? [item]);
}

describe("Commander", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("opens the create note dialog for the new excalidraw command", () => {
		render(
			<Commander
				note={mocks.state.note}
				tabs={mocks.state.tabs}
				notes={mocks.state.notes}
				noteGroups={mocks.state.noteGroups}
				terminalSessions={mocks.state.terminalSessions}
				commander={mocks.state.commander as never}
				dispatch={mocks.dispatch as never}
			/>,
		);

		const command = getFlattenedCommands().find(
			(item) => item.title === "New excalidraw",
		);
		expect(command).toBeDefined();

		const setOpen = vi.fn();
		vi.useFakeTimers();
		command?.action?.({ setOpen });
		vi.runAllTimers();
		vi.useRealTimers();

		expect(setOpen).toHaveBeenCalledWith(false);
		expect(mocks.dispatch.setCreateNoteDialog).toHaveBeenCalledWith({
			isOpen: true,
			type: "excalidraw",
		});
	});

	it("creates a new terminal tab from the terminal command", async () => {
		render(
			<Commander
				note={mocks.state.note}
				tabs={mocks.state.tabs}
				notes={mocks.state.notes}
				noteGroups={mocks.state.noteGroups}
				terminalSessions={mocks.state.terminalSessions}
				commander={mocks.state.commander as never}
				dispatch={mocks.dispatch as never}
			/>,
		);

		const command = getFlattenedCommands().find(
			(item) => item.title === "New Terminal",
		);
		expect(command).toBeDefined();

		const setOpen = vi.fn();
		command?.action?.({ setOpen });
		await Promise.resolve();

		expect(setOpen).toHaveBeenCalledWith(false);
		expect(mocks.dispatch.addTerminalTab).toHaveBeenCalledWith(
			"terminal-session-id",
		);
		expect(mocks.navigate).toHaveBeenCalledWith(
			"/terminal/terminal-session-id",
		);
	});

	it("confirms each terminal by name when closing all tabs", async () => {
		const noteTab = createTab({ id: "note-tab", noteId: "note-1", order: 0 });
		const firstTerminalTab = createTab({
			id: "terminal-tab-1",
			noteId: "terminal-1",
			order: 1,
			type: TERMINAL_TAB_TYPE,
		});
		const secondTerminalTab = createTab({
			id: "terminal-tab-2",
			noteId: "terminal-2",
			order: 2,
			type: TERMINAL_TAB_TYPE,
		});
		render(
			<Commander
				note={mocks.state.note}
				tabs={[noteTab, firstTerminalTab, secondTerminalTab]}
				notes={mocks.state.notes}
				noteGroups={mocks.state.noteGroups}
				terminalSessions={[
					createTerminalSession({ id: "terminal-1", title: "Build logs" }),
					createTerminalSession({ id: "terminal-2", title: "Deploy shell" }),
				]}
				commander={mocks.state.commander as never}
				dispatch={mocks.dispatch as never}
			/>,
		);

		const command = getFlattenedCommands().find(
			(item) => item.title === "Close all tabs",
		);
		expect(command).toBeDefined();

		const setOpen = vi.fn();
		command?.action?.({ setOpen });
		await Promise.resolve();

		expect(setOpen).toHaveBeenCalledWith(false);
		expect(mocks.dispatch.removeTab).toHaveBeenCalledWith("note-tab");
		expect(uiDispatch.setConfirm).toHaveBeenLastCalledWith(
			expect.objectContaining({
				title: "Close Build logs?",
				message:
					'Closing terminal "Build logs" will kill its running shell session.',
			}),
		);

		const firstConfirm = vi
			.mocked(uiDispatch.setConfirm)
			.mock.calls.at(-1)?.[0] as ConfirmState;
		firstConfirm.onConfirm();
		await Promise.resolve();

		expect(mocks.dispatch.removeTab).toHaveBeenCalledWith("terminal-tab-1");
		expect(uiDispatch.setConfirm).toHaveBeenLastCalledWith(
			expect.objectContaining({
				title: "Close Deploy shell?",
				message:
					'Closing terminal "Deploy shell" will kill its running shell session.',
			}),
		);

		const secondConfirm = vi
			.mocked(uiDispatch.setConfirm)
			.mock.calls.at(-1)?.[0] as ConfirmState;
		secondConfirm.onConfirm();
		await Promise.resolve();

		expect(mocks.dispatch.removeTab).toHaveBeenCalledWith("terminal-tab-2");
		expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
	});

	it("opens the shortcuts page from the help command without showing the old shortcut binding", () => {
		render(
			<Commander
				note={mocks.state.note}
				tabs={mocks.state.tabs}
				notes={mocks.state.notes}
				noteGroups={mocks.state.noteGroups}
				terminalSessions={mocks.state.terminalSessions}
				commander={mocks.state.commander as never}
				dispatch={mocks.dispatch as never}
			/>,
		);

		const shortcutHelpCommands = getFlattenedCommands().filter(
			(item) => item.title === "Shortcut/Help menu",
		);
		expect(shortcutHelpCommands).toHaveLength(1);

		const shortcutHelpCommand = shortcutHelpCommands[0];
		expect(shortcutHelpCommand?.shortcut).toBeUndefined();

		const setOpen = vi.fn();
		shortcutHelpCommand?.action?.({ setOpen });

		expect(setOpen).toHaveBeenCalledWith(false);
		expect(mocks.navigate).toHaveBeenCalledWith("/settings/shortcuts");
	});
});
