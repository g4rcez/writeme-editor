import { GithubLogoIcon } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { version } from "@/../package.json";
import { useTemplates } from "@/app/hooks/use-templates";
import { utf8ToBase64 } from "@/lib/encoding";
import { getEditorMarkdown } from "@/lib/editor-storage";
import { isElectron } from "@/lib/is-electron";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { notificationRef } from "@/app/notification-ref";
import {
	getSettingsPath,
	isSettingsSectionAvailable,
} from "@/app/settings/settings-sections";
import { suppressNoteRouteTabOpen } from "@/lib/note-route-tab-open-suppression";
import { printDocument } from "@/lib/print-document";
import { getRouteForTab, isAiChatTab, isTerminalTab } from "@/lib/tab-target";
import {
	CommanderType,
	globalState,
	type CommanderState,
	type GlobalDispatchers,
} from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";
import { uiDispatch } from "@/store/ui.store";
import {
	type CommandItemTypes,
	CommandPalette,
	uuid,
} from "@g4rcez/components";
import { Fragment, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { editorGlobalRef } from "./editor-global-ref";
import {
	mapShortcutOS,
	Type,
	useShortcuts,
	useWritemeShortcuts,
} from "./elements/shortcut-items";
import {
	ChatCircleDotsIcon,
	NoteIcon,
	TerminalIcon,
} from "@phosphor-icons/react";
import { useAiChatTabs } from "./hooks/use-ai-chat-tabs";
import { useNoteTabs } from "./hooks/use-note-tabs";
import type { Tab } from "@/store/repositories/entities/tab";
import type { NoteGroup } from "@/store/repositories/entities/note-group";
import type { TerminalSession } from "@/store/repositories/entities/terminal-session";

export const CommanderPreview = (props: {
	command: CommandItemTypes;
	text: string;
}) => {
	if (props.command.type !== "shortcut") return <Fragment />;
	return <Fragment />;
};

type Props = {
	note: Note | null;
	tabs: Tab[];
	notes: Note[];
	noteGroups: NoteGroup[];
	terminalSessions: TerminalSession[];
	commander: CommanderState;
	dispatch: GlobalDispatchers;
};

export const Commander = (props: Props) => {
	useShortcuts();
	const dispatch = props.dispatch;
	const [, layoutDispatch] = useLayoutStore();
	const { templates } = useTemplates();
	const commands = useWritemeShortcuts();
	const navigate = useNavigate();

	const showActivity = (
		activity: Parameters<typeof layoutDispatch.setActivity>[0],
	) => {
		layoutDispatch.setActivity(activity);
		uiDispatch.setSidebarOpen(true);
	};

	const notesSig = useMemo(
		() => props.notes.map((n: Note) => `${n.id}:${n.title}`).join("|"),
		[props.notes],
	);

	useEffect(() => {
		dispatch.loadGroups();
	}, []);

	const noteGroup = useMemo(
		(): CommandItemTypes[] =>
			globalState().notes.map(
				(note: Note): CommandItemTypes => ({
					Icon: (
						<span className="text-primary text-xs flex items-center gap-1">
							<NoteIcon />
							Note
						</span>
					),
					type: "shortcut",
					title: `${note.title}`,
					action: (args) => {
						args.setOpen(false);
						navigate(`/note/${note.id}`);
					},
				}),
			),
		[notesSig, navigate],
	);

	const notesById = useNoteTabs(props.notes);
	const chatsById = useAiChatTabs(globalState().directory, props.tabs);
	const terminalSessionsById = useMemo(
		() =>
			new Map(props.terminalSessions.map((session) => [session.id, session])),
		[props.terminalSessions],
	);

	const openedTabsGroup = useMemo(
		(): CommandItemTypes[] =>
			[...props.tabs]
				.sort((a, b) => a.order - b.order)
				.map((tab): CommandItemTypes => {
					const isChatTab = isAiChatTab(tab);
					const isTerminal = isTerminalTab(tab);
					const note =
						isChatTab || isTerminal ? undefined : notesById.get(tab.noteId);
					const chat = isChatTab ? chatsById.get(tab.noteId) : undefined;
					const terminalSession = isTerminal
						? terminalSessionsById.get(tab.noteId)
						: undefined;
					let title = note?.title || "Untitled";
					let typeLabel = "Tab";
					let Icon: CommandItemTypes["Icon"];

					if (isTerminal) {
						title = terminalSession?.title?.trim() || "Terminal";
						typeLabel = "Terminal";
						Icon = (
							<span className="text-primary text-xs flex items-center gap-1">
								<TerminalIcon />
								Terminal
							</span>
						);
					} else if (isChatTab) {
						title = chat?.title?.trim() || "AI Chat";
						typeLabel = "Chat";
						Icon = (
							<span className="text-primary text-xs flex items-center gap-1">
								<ChatCircleDotsIcon />
								Chat
							</span>
						);
					}

					return {
						Icon,
						type: "shortcut",
						title: `${typeLabel}: ${title}`,
						action: async (args) => {
							args.setOpen(false);
							if (isTerminal) {
								await dispatch.addTerminalTab(tab.noteId);
							} else if (isChatTab) {
								await dispatch.addAiChatTab(tab.noteId);
							} else {
								await dispatch.selectNoteById(tab.noteId);
							}
							navigate(getRouteForTab(tab));
						},
					};
				}),
		[
			props.tabs,
			notesById,
			chatsById,
			terminalSessionsById,
			dispatch,
			navigate,
		],
	);

	const createNewTerminal = useCallback(async (): Promise<void> => {
		const sessionId = uuid();
		await dispatch.addTerminalTab(sessionId);
		navigate(`/terminal/${encodeURIComponent(sessionId)}`);
	}, [dispatch, navigate]);

	const getTerminalTabTitle = useCallback(
		(tab: Tab): string =>
			terminalSessionsById.get(tab.noteId)?.title?.trim() || "Terminal",
		[terminalSessionsById],
	);

	const closeTabsSequentially = useCallback(
		(tabsToClose: Tab[]): void => {
			for (const tab of tabsToClose) {
				if (!isAiChatTab(tab) && !isTerminalTab(tab)) {
					suppressNoteRouteTabOpen(tab.noteId);
				}
			}

			const closeAt = (index: number): void => {
				const tab = tabsToClose[index];
				if (!tab) {
					dispatch.setNote(null);
					navigate("/", { replace: true });
					return;
				}

				const closeAndContinue = async (): Promise<void> => {
					await dispatch.removeTab(tab.id);
					closeAt(index + 1);
				};

				if (!isTerminalTab(tab)) {
					void closeAndContinue();
					return;
				}

				const title = getTerminalTabTitle(tab);
				uiDispatch.setConfirm({
					open: true,
					type: "danger",
					title: `Close ${title}?`,
					message: `Closing terminal "${title}" will kill its running shell session.`,
					confirmText: "Close Terminal",
					onConfirm: () => {
						uiDispatch.clearConfirm();
						void closeAndContinue();
					},
					onCancel: () => uiDispatch.clearConfirm(),
				});
			};

			closeAt(0);
		},
		[dispatch, getTerminalTabTitle, navigate],
	);

	const options = useMemo(() => {
		if (props.commander.type === CommanderType.Notes) {
			return noteGroup;
		}

		if (props.commander.type === CommanderType.OpenTabs) {
			return openedTabsGroup;
		}

		const notesItem: CommandItemTypes = {
			title: "Notes",
			type: "group",
			items: [
				{
					title: "New note",
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						setTimeout(() => {
							dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
						}, 50);
					},
				},
				{
					title: "New excalidraw",
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						setTimeout(() => {
							dispatch.setCreateNoteDialog({
								isOpen: true,
								type: "excalidraw",
							});
						}, 50);
					},
				},
				{
					title: "Quick note",
					shortcut: mapShortcutOS("mod+alt+n"),
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						if (isElectron()) {
							window.electronAPI.app.openQuickNote();
						} else {
							setTimeout(() => {
								dispatch.setCreateNoteDialog({ isOpen: true, type: "quick" });
							}, 50);
						}
					},
				},
				{
					title: 'New "read it later" note',
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						setTimeout(() => {
							dispatch.readItLaterDialog(true);
						}, 50);
					},
				},
				...(props.note && !props.note.favorite
					? [
							{
								title: "Add current note as favorite",
								type: "shortcut" as const,
								action: async (args: { setOpen: (v: boolean) => void }) => {
									args.setOpen(false);
									const updatedNote = Note.parse({
										...props.note,
										favorite: true,
									});
									try {
										await repositories.notes.update(
											updatedNote.id,
											updatedNote,
										);
										const notes = props.notes.some(
											(n) => n.id === updatedNote.id,
										)
											? props.notes.map((n) =>
													n.id === updatedNote.id ? updatedNote : n,
												)
											: props.notes.concat(updatedNote);
										dispatch.setNote(updatedNote);
										dispatch.notes(notes);
										notificationRef.current?.(
											<span>Added {updatedNote.title} to favorites</span>,
											{ theme: "success", closable: true, timeout: 3000 },
										);
									} catch (error) {
										uiDispatch.setError(
											error instanceof Error
												? error.message
												: "Failed to add note to favorites",
										);
									}
								},
							},
						]
					: []),
				{
					title: "Share content",
					type: "shortcut",
					action: (args) => {
						const editor = editorGlobalRef.current;
						if (editor) {
							const content = getEditorMarkdown(editor);
							const encoded = utf8ToBase64(content);
							const url = isElectron()
								? `${window.location.origin}/#/share?q=${encoded}`
								: `${window.location.origin}/share?q=${encoded}`;
							navigator.clipboard.writeText(url);
						}
						args.setOpen(false);
					},
				},
				...(props.note
					? [
							{
								title: "Print/Export current note",
								type: "shortcut" as const,
								action: (args: { setOpen: (v: boolean) => void }) => {
									args.setOpen(false);
									window.requestAnimationFrame(() => {
										printDocument({ title: props.note?.title });
									});
								},
							},
						]
					: []),
				{
					title: "Inspect Json",
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						setTimeout(() => {
							dispatch.setInspectJsonDialog(true);
						}, 50);
					},
				},
				...(editorGlobalRef.current
					? [
							{
								title: "View Tasks",
								type: "shortcut" as const,
								action: (args: { setOpen: (v: boolean) => void }) => {
									uiDispatch.openTasksDialog();
									args.setOpen(false);
								},
							},
						]
					: []),
				...noteGroup,
			],
		};
		const actions = commands
			.filter((x) => !x.hidden && !x.hideInCommander)
			.filter((x) => x.type === Type.Shortcut)
			.map(
				(x): CommandItemTypes => ({
					title: x.description,
					shortcut: mapShortcutOS(x.bind),
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						x.action();
					},
				}),
			);
		const otherStuff: CommandItemTypes[] = [
			{
				title: "Actions",
				type: "group",
				items: [
					{
						type: "shortcut",
						title: "All notes",
						action: () => navigate("/notes"),
					},
					{
						type: "shortcut",
						title: "Close all tabs",
						action: (args) => {
							args.setOpen(false);
							closeTabsSequentially(
								[...props.tabs].sort((a, b) => a.order - b.order),
							);
						},
					},
					{
						type: "shortcut",
						title: "Find notes",
						action: (args) => {
							dispatch.commander(true, CommanderType.Notes);
							args.setOpen(false);
						},
					},
					{
						type: "shortcut",
						title: "New Terminal",
						action: (args) => {
							args.setOpen(false);
							void createNewTerminal();
						},
					},
					{
						type: "shortcut",
						title: "AI Assistant",
						action: (args) => {
							dispatch.setAiDrawer({ isOpen: true, chatId: null });
							args.setOpen(false);
						},
					},
					...(props.note
						? [
								{
									type: "shortcut" as const,
									title: "Open chat",
									action: (args: { setOpen: (v: boolean) => void }) => {
										dispatch.setAiDrawer({ isOpen: true, chatId: null });
										args.setOpen(false);
									},
								},
							]
						: []),
					...actions,
				],
			},
			{
				title: "Navigate",
				type: "group",
				items: [
					{
						type: "shortcut",
						title: "Templates",
						action: (args) => {
							args.setOpen(false);
							showActivity("templates");
						},
					},
					{
						type: "shortcut",
						title: "Calendar",
						action: (args) => {
							args.setOpen(false);
							navigate("/calendar");
						},
					},
					{
						type: "shortcut",
						title: "Views",
						action: (args) => {
							args.setOpen(false);
							navigate("/views");
						},
					},
					...(isElectron()
						? [
								{
									type: "shortcut" as const,
									title: "Folder workspace",
									action: (args: { setOpen: (v: boolean) => void }) => {
										args.setOpen(false);
										navigate("/folder");
									},
								},
							]
						: []),
					{
						type: "shortcut",
						title: "Migrate data",
						action: (args) => {
							args.setOpen(false);
							navigate("/migrate");
						},
					},
				],
			},
			{
				title: "About",
				type: "group",
				items: [
					{
						title: "About the project",
						type: "shortcut",
						action: (args) => {
							args.setOpen(false);
							navigate("/about");
						},
					},
					{
						title: "Examples",
						type: "shortcut",
						action: (args) => {
							args.setOpen(false);
							navigate("/examples");
						},
					},
					...(isSettingsSectionAvailable("shortcuts")
						? [
								{
									title: "Shortcut/Help menu",
									type: "shortcut" as const,
									action: (args: { setOpen: (v: boolean) => void }) => {
										args.setOpen(false);
										navigate(getSettingsPath("shortcuts"));
									},
								},
							]
						: []),
					{
						title: "Settings",
						type: "shortcut",
						action: (args) => {
							args.setOpen(false);
							navigate("/settings");
						},
					},
				],
			},
		];
		const templateItem: CommandItemTypes = {
			title: "Templates",
			type: "group",
			items: [
				{
					title: "Manage templates",
					type: "shortcut",
					action: (args) => {
						args.setOpen(false);
						showActivity("templates");
					},
				},
				...templates.map(
					(t): CommandItemTypes => ({
						title: `Template: ${t.title}`,
						type: "shortcut",
						action: (args) => {
							args.setOpen(false);
							setTimeout(() => {
								dispatch.setCreateNoteDialog({
									isOpen: true,
									type: "note",
									templateId: t.id,
								});
							}, 50);
						},
					}),
				),
			],
		};

		const noteGroupsItem: CommandItemTypes = {
			title: "Note Groups",
			type: "group",
			items: [
				...(props.note
					? [
							{
								title: "Add current note to group",
								type: "shortcut" as const,
								action: (args: { setOpen: (v: boolean) => void }) => {
									args.setOpen(false);
									setTimeout(() => dispatch.setAddToGroupDialog(true), 50);
								},
							},
						]
					: []),
				{
					title: "Manage groups",
					type: "shortcut" as const,
					action: (args: { setOpen: (v: boolean) => void }) => {
						args.setOpen(false);
						navigate("/groups");
					},
				},
				...props.noteGroups.map(
					(g): CommandItemTypes => ({
						title: `Group: ${g.title}`,
						type: "shortcut",
						action: (args) => {
							args.setOpen(false);
							navigate(`/groups/${g.id}`);
						},
					}),
				),
			],
		};

		const installerGroup: CommandItemTypes | null = isElectron()
			? {
					title: "Installers",
					type: "group",
					items: [
						{
							title: "Install CLI",
							type: "shortcut",
							action: async (args) => {
								args.setOpen(false);
								const result = await window.electronAPI.app.installCli();
								if (result.success) {
									notificationRef.current?.(
										<span>CLI installed at {result.installPath}</span>,
										{ theme: "success", closable: true, timeout: 4000 },
									);
								} else {
									notificationRef.current?.(
										<span>Failed to install CLI: {result.error}</span>,
										{ theme: "danger", closable: true, timeout: 6000 },
									);
								}
							},
						},
					],
				}
			: null;

		const gitDirectory = isElectron() ? SettingsService.load().directory : null;
		const gitGroup: CommandItemTypes | null = gitDirectory
			? {
					title: "Git",
					type: "group",
					items: [
						{
							title: "[git] Commit & push",
							type: "shortcut",
							action: (args) => {
								args.setOpen(false);
								setTimeout(() => uiDispatch.openGitDialog(), 50);
							},
						},
					],
				}
			: null;

		return [
			notesItem,
			templateItem,
			noteGroupsItem,
			...(gitGroup ? [gitGroup] : []),
			...(installerGroup ? [installerGroup] : []),
			...otherStuff,
		];
	}, [
		props.commander,
		props.noteGroups,
		props.note,
		props.notes,
		props.tabs,
		noteGroup,
		openedTabsGroup,
		closeTabsSequentially,
		createNewTerminal,
		navigate,
		dispatch,
		commands,
		templates,
	]);

	return (
		<CommandPalette
			commands={options}
			open={props.commander.enabled}
			onChangeVisibility={dispatch.commander}
			footer={
				<div className="flex justify-between items-center min-w-full text-sm text-disabled">
					Version: {version}
					<a
						target="_blank"
						rel="noopener noreferrer"
						className="flex gap-1 items-center link"
						href="https://github.com/g4rcez/writeme-editor"
					>
						<GithubLogoIcon />
						writeme
					</a>
				</div>
			}
		/>
	);
};
