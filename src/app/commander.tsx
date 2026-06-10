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
import { printDocument } from "@/lib/print-document";
import {
  CommanderType,
  globalState,
  useGlobalStore,
} from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";
import { uiDispatch } from "@/store/ui.store";
import { type CommandItemTypes, CommandPalette } from "@g4rcez/components";
import { Fragment, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { editorGlobalRef } from "./editor-global-ref";
import {
  mapShortcutOS,
  Type,
  useShortcuts,
  useWritemeShortcuts,
} from "./elements/shortcut-items";
import { NoteIcon } from "@phosphor-icons/react";

export const CommanderPreview = (props: {
  command: CommandItemTypes;
  text: string;
}) => {
  if (props.command.type !== "shortcut") return <Fragment />;
  return <Fragment />;
};

export const Commander = () => {
  useShortcuts();
  const [state, dispatch] = useGlobalStore();
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
    () => state.notes.map((n: Note) => `${n.id}:${n.title}`).join("|"),
    [state.notes],
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

  const openedTabsGroup = useMemo(
    (): CommandItemTypes[] =>
      [...state.tabs]
        .sort((a, b) => a.order - b.order)
        .map((tab): CommandItemTypes => {
          const note = state.notes.find((n: Note) => n.id === tab.noteId);
          const title = note?.title || "Untitled";
          return {
            type: "shortcut",
            title: `Tab: ${title}`,
            action: async (args) => {
              args.setOpen(false);
              await dispatch.selectNoteById(tab.noteId);
              navigate(`/note/${tab.noteId}`);
            },
          };
        }),
    [state.tabs, state.notes, dispatch, navigate],
  );

  const options = useMemo(() => {
    if (state.commander.type === CommanderType.Notes) {
      return noteGroup;
    }

    if (state.commander.type === CommanderType.OpenTabs) {
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
        ...(state.note && !state.note.favorite
          ? [
              {
                title: "Add current note as favorite",
                type: "shortcut" as const,
                action: async (args: { setOpen: (v: boolean) => void }) => {
                  args.setOpen(false);
                  const updatedNote = Note.parse({
                    ...state.note,
                    favorite: true,
                  });
                  try {
                    await repositories.notes.update(
                      updatedNote.id,
                      updatedNote,
                    );
                    const notes = state.notes.some(
                      (n) => n.id === updatedNote.id,
                    )
                      ? state.notes.map((n) =>
                          n.id === updatedNote.id ? updatedNote : n,
                        )
                      : state.notes.concat(updatedNote);
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
        ...(state.note
          ? [
              {
                title: "Print/Export current note",
                type: "shortcut" as const,
                action: (args: { setOpen: (v: boolean) => void }) => {
                  args.setOpen(false);
                  window.requestAnimationFrame(() => {
                    printDocument({ title: state.note?.title });
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
              navigate("/");
              dispatch.clearTabs();
              args.setOpen(false);
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
            title: "Toggle Terminal",
            action: (args) => {
              dispatch.toggleTerminal();
              args.setOpen(false);
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
          ...(state.note
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
        ...(state.note
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
        ...state.noteGroups.map(
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
    state.commander,
    state.noteGroups,
    state.note,
    state.notes,
    noteGroup,
    openedTabsGroup,
    navigate,
    dispatch,
    commands,
    templates,
  ]);

  return (
    <CommandPalette
      commands={options}
      open={state.commander.enabled}
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
