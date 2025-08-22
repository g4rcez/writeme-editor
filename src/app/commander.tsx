import { useGlobalStore } from "../store/global.store";
import {
  mapShortcutOS,
  Type,
  useShortcuts,
  useWritemeShortcuts,
} from "./elements/shortcut-items";
import { CommandPalette } from "@g4rcez/components";

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
