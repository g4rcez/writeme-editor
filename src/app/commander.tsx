import { GithubLogoIcon } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { version } from "@/../package.json";
import { useTemplates } from "@/app/hooks/use-templates";
import { utf8ToBase64 } from "@/lib/encoding";
import { isElectron } from "@/lib/is-electron";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { type CommandItemTypes, CommandPalette } from "@g4rcez/components";
import { Fragment, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { editorGlobalRef } from "./editor-global-ref";
import {
  mapShortcutOS,
  Type,
  useShortcuts,
  useWritemeShortcuts,
} from "./elements/shortcut-items";

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
  const { templates } = useTemplates();
  const commands = useWritemeShortcuts();
  const navigate = useNavigate();

  const options = useMemo(() => {
    const noteGroup = state.notes.map((note: Note): CommandItemTypes => {
      return {
        type: "shortcut",
        title: `Note: ${note.title}`,
        action: (args) => {
          args.setOpen(false);
          navigate(`/note/${note.id}`);
        },
      };
    });
    if (state.commander.type === CommanderType.Notes) {
      return noteGroup;
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
            setTimeout(() => {
              dispatch.setCreateNoteDialog({ isOpen: true, type: "quick" });
            }, 50);
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
        {
          title: "Share content",
          type: "shortcut",
          action: (args) => {
            const editor = editorGlobalRef.current;
            if (editor) {
              const content = (editor.storage as any).markdown.getMarkdown();
              const encoded = utf8ToBase64(content);
              const url = isElectron()
                ? `${window.location.origin}/#/share?q=${encoded}`
                : `${window.location.origin}/share?q=${encoded}`;
              navigator.clipboard.writeText(url);
            }
            args.setOpen(false);
          },
        },
        ...noteGroup,
      ],
    };
    const actions = commands
      .filter((x) => !x.hidden)
      .filter((x) => x.type === Type.Shortcut)
      .map(
        (x): CommandItemTypes => ({
          title: x.description,
          shortcut: mapShortcutOS(x.bind),
          type: "shortcut",
          action: (args) => {
            x.action();
            args.setOpen(false);
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
            title: "Find notes",
            action: (args) => {
              dispatch.commander(true, CommanderType.Notes);
              args.setOpen(false);
            },
          },
          ...actions,
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
    const aiItem: CommandItemTypes = {
      title: "AI Assistant",
      type: "group",
      items: [
        {
          title: "Open AI Chat",
          shortcut: mapShortcutOS("mod+alt+a"),
          type: "shortcut",
          action: (args) => {
            args.setOpen(false);
            setTimeout(() => {
              dispatch.setAiDrawer({ isOpen: true, chatId: null });
            }, 50);
          },
        },
      ],
    };

    const templateItem: CommandItemTypes = {
      title: "Templates",
      type: "group",
      items: [
        {
          title: "Manage templates",
          type: "shortcut",
          action: (args) => {
            args.setOpen(false);
            // We don't have a direct route for all templates, but we can set the activity
            // Since this is in the commander, maybe we should just open the sidebar?
            // Or navigate to a specific page if it existed.
            // For now, let's just trigger the sidebar activity if possible.
            // But usually commander is for quick actions.
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

    return [aiItem, notesItem, templateItem, ...otherStuff];
  }, [state.commander, state.notes, navigate, dispatch, commands, templates]);

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
