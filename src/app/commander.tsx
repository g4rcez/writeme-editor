import { Note } from "../store/note";
import { repositories, useGlobalStore } from "../store/global.store";
import {
  mapShortcutOS,
  Type,
  useShortcuts,
  useWritemeShortcuts,
} from "./elements/shortcut-items";
import { CommandItemTypes, CommandPalette } from "@g4rcez/components";

export const Commander = () => {
  const [state, dispatch] = useGlobalStore();
  const commands = useWritemeShortcuts();
  useShortcuts();

  return (
    <CommandPalette
      open={state.commander}
      onChangeVisibility={dispatch.commander}
      commands={[
        {
          title: "Notas",
          type: "group",
          items: [
            {
              title: "New note",
              type: "shortcut",
              action: (args) => {
                const newNote = Note.new("Untitled", "");
                repositories.notes.save(newNote);
                dispatch.note(newNote);
                args.setOpen(false);
              },
            },
            ...state.notes.map((note): CommandItemTypes => {
              return {
                type: "shortcut",
                title: `Note: ${note.title}`,
                action: (args) => {
                  args.setOpen(false);
                  dispatch.note(note);
                },
              };
            }),
          ],
        },
        {
          title: "Actions",
          items: commands
            .filter((x) => !x.hidden)
            .filter((x) => x.type === Type.Shortcut)
            .map((x) => ({
              title: x.description,
              shortcut: mapShortcutOS(x.bind),
              type: "shortcut",
              action: (args) => {
                x.action();
                args.setOpen(false);
              },
            })),
          type: "group",
        },
      ]}
    />
  );
};
