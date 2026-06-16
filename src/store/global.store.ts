import { createZustandCompatStore } from "./zustand-compat";
import { uuid } from "@g4rcez/components";
import { getPreviousTabAfterClose } from "@/lib/tab-closing";
import {
	AI_CHAT_TAB_TYPE,
	NOTE_TAB_TYPE,
	TERMINAL_TAB_TYPE,
	getTabTargetKeyForTab,
	isAiChatTab,
	isNoteTabForNoteId,
	isTerminalTab,
} from "@/lib/tab-target";
import { isElectron } from "@/lib/is-electron";
import type { Note } from "./note";
import { repositories } from "./repositories";
import type { Tab } from "./repositories/entities/tab";
import {
	type TerminalSession,
	TERMINAL_SESSION_ENTITY_TYPE,
} from "./repositories/entities/terminal-session";
import { NoteGroup } from "./repositories/entities/note-group";
import { NoteGroupMember } from "./repositories/entities/note-group-member";
import { uiDispatch } from "./ui.store";
import { SettingsService } from "./settings";
import type { Toggle } from "./types";

export type NoteCreationType = "note" | "quick" | "excalidraw";

const LOCAL_WORKSPACE_KEY = "__local__";

export function getWorkspaceKey(directory: string | null): string {
	return directory && directory.trim().length > 0
		? directory
		: LOCAL_WORKSPACE_KEY;
}

const getTabCreatedTime = (tab: Tab): number =>
	tab.createdAt instanceof Date
		? tab.createdAt.getTime()
		: new Date(tab.createdAt).getTime();

export function normalizeWorkspaceTabs(
	tabs: Tab[],
	workspaceKey: string,
): { tabs: Tab[]; duplicateTabs: Tab[] } {
	const sortedTabs = [...tabs].sort((a, b) => {
		const projectDifference =
			Number(b.project === workspaceKey) - Number(a.project === workspaceKey);
		if (projectDifference !== 0) return projectDifference;
		const orderDifference = a.order - b.order;
		if (orderDifference !== 0) return orderDifference;
		return getTabCreatedTime(a) - getTabCreatedTime(b);
	});
	const tabsByTarget = new Map<string, Tab>();
	const duplicateTabs: Tab[] = [];

	for (const tab of sortedTabs) {
		const normalizedTab = { ...tab, project: workspaceKey };
		const targetKey = getTabTargetKeyForTab(normalizedTab);
		const existingTab = tabsByTarget.get(targetKey);
		if (!existingTab) {
			tabsByTarget.set(targetKey, normalizedTab);
			continue;
		}

		duplicateTabs.push(tab);
	}

	const normalizedTabs = Array.from(tabsByTarget.values()).map((tab, order) =>
		tab.order === order ? tab : { ...tab, order },
	);

	return { tabs: normalizedTabs, duplicateTabs };
}

export enum CommanderType {
	All = "all",
	Notes = "Notes",
	OpenTabs = "OpenTabs",
}

export type CommanderState = { enabled: boolean; type: CommanderType };

export type AiContext = {
	context: string;
	selection: string;
	selectionSlice: { from: number; to: number } | null;
};

export type Theme =
	| "light"
	| "dark"
	| "catppuccin-mocha"
	| "tokyonight-night"
	| "native";

const THEME_CLASSES = [
	"dark",
	"catppuccin-mocha",
	"tokyonight-night",
	"native",
] as const;

type State = {
	tabs: Tab[];
	theme: Theme;
	help: boolean;
	notes: Note[];
	note: Note | null;
	recentNotes: Note[];
	commander: CommanderState;
	sidebarWidth: number;
	editorFontSize: number;
	homedir: string | null;
	noteGroups: NoteGroup[];
	directory: string | null;
	terminalSessions: TerminalSession[];
	restoredTerminalSessionIds: string[];
	terminalVisible: boolean;
	addToGroupDialog: boolean;
	activeTabId: string | null;
	inspectJsonDialog: boolean;
	readItLaterDialog: boolean;
	recentNotesDialog: boolean;
	aiContext: AiContext | null;
	explorerRoot: string | null;
	directoryBrowserDialog: boolean;
	noteGroupMembers: NoteGroupMember[];
	inspectJsonInitialContent: string | null;
	createTemplateDialog: { isOpen: boolean };
	createVariableDialog: { isOpen: boolean };
	aiDrawer: { isOpen: boolean; chatId: string | null };
	createNoteDialog: {
		isOpen: boolean;
		templateId?: string;
		initialTitle?: string;
		type: NoteCreationType;
	};
};

const initialState: State = {
	help: false,
	homedir: null,
	aiContext: null,
	directory: null,
	sidebarWidth: 320,
	tabs: [] as Tab[],
	editorFontSize: 16,
	explorerRoot: null,
	notes: [] as Note[],
	terminalVisible: false,
	addToGroupDialog: false,
	inspectJsonDialog: false,
	readItLaterDialog: false,
	recentNotesDialog: false,
	note: null as Note | null,
	recentNotes: [] as Note[],
	directoryBrowserDialog: false,
	noteGroups: [] as NoteGroup[],
	terminalSessions: [] as TerminalSession[],
	restoredTerminalSessionIds: [] as string[],
	inspectJsonInitialContent: null,
	theme: "dark" as Theme,
	activeTabId: null as string | null,
	createTemplateDialog: { isOpen: false },
	createVariableDialog: { isOpen: false },
	aiDrawer: { isOpen: false, chatId: null },
	noteGroupMembers: [] as NoteGroupMember[],
	commander: { enabled: false, type: CommanderType.All } as CommanderState,
	createNoteDialog: { isOpen: false, type: "note" as NoteCreationType },
};

export const loadHomedir = async (): Promise<string | null> => {
	if (!isElectron() || typeof window === "undefined") return null;
	try {
		return (await window.electronAPI?.env?.getHome?.()) ?? null;
	} catch (error) {
		console.warn("Failed to load home directory:", error);
		return null;
	}
};
export const useGlobalStore = createZustandCompatStore(initialState, (get) => {
	const setNotes = (notes: Note[]) => {
		const state = get.state();
		const existingNotesMap = new Map<string, Note>(
			state.notes.map((n) => [n.id, n]),
		);
		const mergedNotes = notes.map((note): Note => {
			const existing = existingNotesMap.get(note.id);
			if (existing) {
				if (existing.updatedAt > note.updatedAt) return existing as Note;
			}
			return note;
		});
		return { notes: mergedNotes as Note[] };
	};

	const updateNoteInList = (note: Note) => {
		const state = get.state();
		const existsInNotes = state.notes.some((n) => n.id === note.id);
		return existsInNotes
			? state.notes.map((n) => (n.id === note.id ? note : n))
			: state.notes.concat(note);
	};

	const createTab = (noteId: string, type = NOTE_TAB_TYPE): Tab => {
		const state = get.state();
		const now = new Date();
		return {
			noteId,
			project: getWorkspaceKey(state.directory),
			type,
			createdAt: now,
			updatedAt: now,
			id: uuid(),
			order: state.tabs.length,
			scrollY: 0,
		};
	};

	const getNextTerminalTitle = (sessions: TerminalSession[]): string => {
		const titles = new Set(sessions.map((session) => session.title.trim()));
		if (!titles.has("Terminal")) return "Terminal";

		let suffix = 2;
		while (titles.has(`Terminal ${suffix}`)) {
			suffix += 1;
		}
		return `Terminal ${suffix}`;
	};

	const createTerminalSession = (sessionId: string): TerminalSession => {
		const state = get.state();
		const now = new Date();
		return {
			id: sessionId,
			title: getNextTerminalTitle(state.terminalSessions),
			project: getWorkspaceKey(state.directory),
			type: TERMINAL_SESSION_ENTITY_TYPE,
			createdAt: now,
			updatedAt: now,
		};
	};

	const selectOrAddTab = async (
		note: Note,
		createTabIfMissing: boolean = true,
	) => {
		const state = get.state();
		if (state.activeTabId === note.id && state.note === note) {
			return state;
		}
		const existingTab = state.tabs.find((t) => isNoteTabForNoteId(t, note.id));
		const updatedNotes = updateNoteInList(note);
		if (existingTab) {
			return {
				note: note,
				notes: updatedNotes,
				activeTabId: existingTab.id,
			};
		}
		if (!createTabIfMissing) {
			return { note: note, notes: updatedNotes };
		}
		const newTab = createTab(note.id);
		await repositories.tabs.save(newTab);
		return {
			note: note,
			notes: updatedNotes,
			activeTabId: newTab.id,
			tabs: state.tabs.concat(newTab),
		};
	};

	return {
		notes: setNotes,
		tabs: (tabs: Tab[]) => ({ tabs }),
		help: (help: boolean) => ({ help }),
		setNote: (note: Note | null) => ({ note }),
		recentNotes: (recentNotes: Note[]) => ({ recentNotes }),
		activeTabId: (activeTabId: string | null) => ({ activeTabId }),
		commander: (enabled: boolean, type?: CommanderType) => ({
			commander: { enabled, type: type || CommanderType.All },
		}),
		syncNoteState: (note: Note) => {
			const state = get.state();
			const updatedNotes = state.notes.map((n) =>
				n.id === note.id ? note : n,
			);
			return {
				note,
				notes: updatedNotes,
			};
		},
		init: async (
			theme: Theme,
			notes: Note[],
			tabs: Tab[],
			editorFontSize: number,
			sidebarWidth: number,
			directory: string | null,
			explorerRoot: string | null,
			terminalSessions: TerminalSession[],
		) => {
			for (const className of THEME_CLASSES) {
				document.documentElement.classList.remove(className);
			}
			if (theme !== "light") document.documentElement.classList.add(theme);
			const homedir = await loadHomedir();
			return {
				tabs,
				theme,
				editorFontSize,
				sidebarWidth,
				homedir,
				directory,
				explorerRoot,
				terminalSessions,
				restoredTerminalSessionIds: terminalSessions.map(
					(session) => session.id,
				),
				notes: setNotes(notes).notes,
			};
		},
		setEditorFontSize: (editorFontSize: number) => {
			SettingsService.save({ editorFontSize });
			return { editorFontSize };
		},
		setSidebarWidth: (sidebarWidth: number) => {
			SettingsService.save({ sidebarWidth });
			return { sidebarWidth };
		},
		recentNotesDialog: (recentNotesDialog: boolean) => ({
			recentNotesDialog,
		}),
		setInspectJsonDialog: (
			inspectJsonDialog: boolean,
			content?: string | null,
		) => ({
			inspectJsonDialog,
			inspectJsonInitialContent: content ?? null,
		}),
		readItLaterDialog: (readItLaterDialog: boolean) => ({
			readItLaterDialog,
		}),
		setAddToGroupDialog: (addToGroupDialog: boolean) => ({
			addToGroupDialog,
		}),
		setCreateNoteDialog: (createNoteDialog: {
			isOpen: boolean;
			type: NoteCreationType;
			templateId?: string;
			initialTitle?: string;
		}) => ({ createNoteDialog }),
		setCreateTemplateDialog: (isOpen: boolean) => ({
			createTemplateDialog: { isOpen },
		}),
		setCreateVariableDialog: (isOpen: boolean) => ({
			createVariableDialog: { isOpen },
		}),
		setAiDrawer: (
			aiDrawer: Toggle<{ isOpen: boolean; chatId: string | null }>,
		) => {
			const result =
				typeof aiDrawer === "function"
					? aiDrawer(get.state().aiDrawer)
					: aiDrawer;
			return { aiDrawer: result };
		},
		toggleTerminal: () => {
			return { terminalVisible: !get.state().terminalVisible };
		},
		setTerminalVisible: (terminalVisible: boolean) => ({ terminalVisible }),
		setAiContext: (aiContext: AiContext | null) => ({ aiContext }),
		loadRecentNotes: async (limit = 20) => {
			const recent = await repositories.notes.getAll({ limit });
			return { recentNotes: recent };
		},
		reorderTabs: async (tabs: Tab[]) => {
			const updatedTabs = tabs.map((t, i) => ({ ...t, order: i }));
			await repositories.tabs.updateOrder(updatedTabs);
			return { tabs: updatedTabs };
		},
		clearTabs: async () => {
			const state = get.state();
			await Promise.all([
				...state.tabs.map((tab) => repositories.tabs.delete(tab.id)),
				...state.tabs
					.filter(isTerminalTab)
					.map((tab) => repositories.terminalSessions.delete(tab.noteId)),
			]);
			return {
				tabs: [],
				activeTabId: null,
				note: null,
				terminalSessions: state.terminalSessions.filter(
					(session) =>
						!state.tabs.some(
							(tab) => isTerminalTab(tab) && tab.noteId === session.id,
						),
				),
			};
		},
		switchWorkspace: async (directory: string | null) => {
			await SettingsService.save({
				directory,
				explorerRoot: directory,
			});
			if (isElectron()) {
				await window.electronAPI.app.setLaunchWorkspace(directory);
			}
			if (isElectron() && directory) {
				await window.electronAPI.app.chdir(directory);
				await window.electronAPI.fs.startWatcher(directory);
			}
			window.location.reload();
			return get.state();
		},
		directoryBrowserDialog: (directoryBrowserDialog: boolean) => ({
			directoryBrowserDialog,
		}),
		note: async (note: Note, createTabIfMissing: boolean = true) => {
			try {
				await repositories.notes.update(note.id, note);
			} catch (error: any) {
				uiDispatch.setError(error.message || "Failed to update note");
				return {};
			}
			return selectOrAddTab(note, createTabIfMissing);
		},
		addTab: async (noteId: string) => {
			const currentTabs = get.state().tabs;
			const existingTab = currentTabs.find((t) =>
				isNoteTabForNoteId(t, noteId),
			);
			if (existingTab) {
				return { activeTabId: existingTab.id };
			}
			const newTab = createTab(noteId);
			await repositories.tabs.save(newTab);
			return { activeTabId: newTab.id, tabs: currentTabs.concat(newTab) };
		},
		addAiChatTab: async (chatId: string) => {
			const currentTabs = get.state().tabs;
			const existingTab = currentTabs.find(
				(tab) => isAiChatTab(tab) && tab.noteId === chatId,
			);
			if (existingTab) {
				return { activeTabId: existingTab.id };
			}
			const newTab = createTab(chatId, AI_CHAT_TAB_TYPE);
			await repositories.tabs.save(newTab);
			return { activeTabId: newTab.id, tabs: currentTabs.concat(newTab) };
		},
		ensureTerminalSession: async (sessionId: string) => {
			const state = get.state();
			if (state.terminalSessions.some((item) => item.id === sessionId)) {
				return state;
			}

			const existingSession =
				await repositories.terminalSessions.getOne(sessionId);
			const session = existingSession ?? createTerminalSession(sessionId);
			if (!existingSession) {
				await repositories.terminalSessions.save(session);
			}
			return { terminalSessions: state.terminalSessions.concat(session) };
		},
		addTerminalTab: async (sessionId: string) => {
			const state = get.state();
			let terminalSessions = state.terminalSessions;
			let session = terminalSessions.find((item) => item.id === sessionId);

			if (!session) {
				const existingSession =
					await repositories.terminalSessions.getOne(sessionId);
				session = existingSession ?? createTerminalSession(sessionId);
				if (!existingSession) {
					await repositories.terminalSessions.save(session);
				}
				terminalSessions = terminalSessions.concat(session);
			}

			const existingTab = state.tabs.find(
				(tab) => isTerminalTab(tab) && tab.noteId === sessionId,
			);
			if (existingTab) {
				return { activeTabId: existingTab.id, terminalSessions };
			}

			const newTab = createTab(sessionId, TERMINAL_TAB_TYPE);
			await repositories.tabs.save(newTab);
			return {
				activeTabId: newTab.id,
				tabs: state.tabs.concat(newTab),
				terminalSessions,
			};
		},
		renameTerminalSession: async (sessionId: string, title: string) => {
			const trimmedTitle = title.trim();
			if (!trimmedTitle) return get.state();

			const state = get.state();
			const session =
				state.terminalSessions.find((item) => item.id === sessionId) ??
				(await repositories.terminalSessions.getOne(sessionId));
			if (!session) return state;

			const updatedSession = {
				...session,
				title: trimmedTitle,
				updatedAt: new Date(),
			};
			await repositories.terminalSessions.save(updatedSession);
			const terminalSessions = state.terminalSessions.some(
				(item) => item.id === sessionId,
			)
				? state.terminalSessions.map((item) =>
						item.id === sessionId ? updatedSession : item,
					)
				: state.terminalSessions.concat(updatedSession);
			return { terminalSessions };
		},
		removeTab: async (id: string) => {
			const state = get.state();
			const closedTab = state.tabs.find((tab) => tab.id === id);
			await repositories.tabs.delete(id);
			if (closedTab && isTerminalTab(closedTab)) {
				await repositories.terminalSessions.delete(closedTab.noteId);
			}
			const tabs = state.tabs.filter((tab) => tab.id !== id);
			const terminalSessions = closedTab
				? state.terminalSessions.filter(
						(session) =>
							!isTerminalTab(closedTab) || session.id !== closedTab.noteId,
					)
				: state.terminalSessions;
			const isClosingActiveTab = (() => {
				if (!closedTab) return false;
				if (state.activeTabId === id) return true;
				if (isAiChatTab(closedTab) || isTerminalTab(closedTab)) {
					return state.activeTabId === closedTab.noteId;
				}
				return (
					state.activeTabId === closedTab.noteId ||
					(state.activeTabId === null && state.note?.id === closedTab.noteId)
				);
			})();
			if (!isClosingActiveTab) {
				return { tabs, activeTabId: state.activeTabId, terminalSessions };
			}
			const tab = getPreviousTabAfterClose(state.tabs, id);
			return {
				tabs,
				activeTabId: tab?.id ?? null,
				note: null,
				terminalSessions,
			};
		},
		removeTabByNoteId: async (noteId: string) => {
			const state = get.state();
			await repositories.tabs.deleteByNoteId(noteId);
			const tabs = state.tabs.filter((tab) => !isNoteTabForNoteId(tab, noteId));
			const activeTabId =
				state.activeTabId &&
				state.tabs.find(
					(tab) =>
						tab.id === state.activeTabId && isNoteTabForNoteId(tab, noteId),
				)
					? (tabs[0]?.id ?? null)
					: state.activeTabId;
			const note = state.note?.id === noteId ? null : state.note;
			return { tabs, activeTabId, note };
		},
		deleteNote: async (id: string) => {
			const state = get.state();
			await repositories.notes.delete(id);
			const tabs = state.tabs.filter((tab) => !isNoteTabForNoteId(tab, id));
			const activeTabId =
				state.activeTabId &&
				state.tabs.find(
					(tab) => tab.id === state.activeTabId && isNoteTabForNoteId(tab, id),
				)
					? (tabs[0]?.id ?? null)
					: state.activeTabId;
			const notes = state.notes.filter((n) => n.id !== id);
			const note = state.note?.id === id ? null : state.note;
			return { notes, tabs, activeTabId, note };
		},
		hardDeleteNote: async (id: string) => {
			const state = get.state();
			await repositories.notes.hardDelete(id);
			await repositories.noteGroupMembers.deleteByNoteId(id);
			const tabs = state.tabs.filter((tab) => !isNoteTabForNoteId(tab, id));
			const activeTabId =
				state.activeTabId &&
				state.tabs.find(
					(tab) => tab.id === state.activeTabId && isNoteTabForNoteId(tab, id),
				)
					? (tabs[0]?.id ?? null)
					: state.activeTabId;
			const notes = state.notes.filter((n) => n.id !== id);
			const note = state.note?.id === id ? null : state.note;
			const noteGroupMembers = state.noteGroupMembers.filter(
				(m) => m.noteId !== id,
			);
			return { notes, tabs, activeTabId, note, noteGroupMembers };
		},
		restoreNote: async (id: string) => {
			const state = get.state();
			const restored = await repositories.notes.restore(id);
			if (!restored) return state;
			return { notes: state.notes.concat(restored) };
		},
		emptyTrash: async () => {
			const state = get.state();
			await repositories.notes.emptyTrash();
			return state;
		},
		updateNoteContent: async (id: string, content: string) => {
			try {
				await repositories.notes.updateContent(id, content);
				const state = get.state();
				const updatedAt = new Date();
				const patch = <T extends Note>(n: T): T =>
					Object.assign(Object.create(Object.getPrototypeOf(n)), n, {
						content,
						updatedAt,
					});
				const notes = state.notes.map((n) => (n.id === id ? patch(n) : n));
				const note = state.note?.id === id ? patch(state.note) : state.note;
				return { notes, note };
			} catch (error: any) {
				uiDispatch.setError(error.message || "Failed to update note content");
				return get.state();
			}
		},
		theme: (theme: Toggle<string>) => {
			const result =
				typeof theme === "function" ? theme(get.state().theme) : theme;
			for (const className of THEME_CLASSES) {
				document.documentElement.classList.remove(className);
			}
			if (result !== "light") document.documentElement.classList.add(result);
			SettingsService.save({ theme: result as Theme });
			return { theme: result as Theme };
		},
		selectNoteById: async (noteId: string) => {
			const state = get.state();
			const note = await repositories.notes.getOne(noteId);
			if (!note) {
				uiDispatch.setError("Failed to load note");
				return state;
			}
			return selectOrAddTab(note);
		},
		loadGroups: async () => {
			const [noteGroups, noteGroupMembers] = await Promise.all([
				repositories.noteGroups.getAll(),
				repositories.noteGroupMembers.getAll(),
			]);
			return { noteGroups, noteGroupMembers };
		},
		createGroup: async (title: string, description?: string) => {
			const now = new Date();
			const group = new NoteGroup(uuid(), title, description ?? null, now, now);
			await repositories.noteGroups.save(group);
			const state = get.state();
			return { noteGroups: state.noteGroups.concat(group) };
		},
		deleteGroup: async (id: string) => {
			await repositories.noteGroupMembers.deleteByGroupId(id);
			await repositories.noteGroups.delete(id);
			const state = get.state();
			return {
				noteGroups: state.noteGroups.filter((g) => g.id !== id),
				noteGroupMembers: state.noteGroupMembers.filter(
					(m) => m.groupId !== id,
				),
			};
		},
		updateGroup: async (
			id: string,
			partial: Partial<Pick<NoteGroup, "title" | "description">>,
		) => {
			const state = get.state();
			const existing = state.noteGroups.find((g) => g.id === id);
			if (!existing) return state;
			const updated = {
				...existing,
				...partial,
				updatedAt: new Date(),
			} as NoteGroup;
			await repositories.noteGroups.save(updated);
			return {
				noteGroups: state.noteGroups.map((g) => (g.id === id ? updated : g)),
			};
		},
		addNoteToGroup: async (groupId: string, noteId: string) => {
			const state = get.state();
			const alreadyMember = state.noteGroupMembers.some(
				(m) => m.groupId === groupId && m.noteId === noteId,
			);
			if (alreadyMember) return state;
			const existing = state.noteGroupMembers.filter(
				(m) => m.groupId === groupId,
			);
			const maxOrder = existing.reduce((max, m) => Math.max(max, m.order), -1);
			const now = new Date();
			const member = new NoteGroupMember(
				uuid(),
				groupId,
				noteId,
				maxOrder + 1,
				now,
				now,
			);
			await repositories.noteGroupMembers.save(member);
			return { noteGroupMembers: state.noteGroupMembers.concat(member) };
		},
		removeNoteFromGroup: async (groupId: string, noteId: string) => {
			const state = get.state();
			const member = state.noteGroupMembers.find(
				(m) => m.groupId === groupId && m.noteId === noteId,
			);
			if (!member) return state;
			await repositories.noteGroupMembers.delete(member.id);
			return {
				noteGroupMembers: state.noteGroupMembers.filter(
					(m) => !(m.groupId === groupId && m.noteId === noteId),
				),
			};
		},
		reorderGroupMembers: async (
			groupId: string,
			members: NoteGroupMember[],
		) => {
			const state = get.state();
			await repositories.noteGroupMembers.reorder(groupId, members);
			return {
				noteGroupMembers: state.noteGroupMembers
					.filter((m) => m.groupId !== groupId)
					.concat(members),
			};
		},
	} as const;
});

export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;

export type GlobalDispatchers = typeof globalDispatch;

export { repositories };
