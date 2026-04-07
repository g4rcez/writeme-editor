import { Modal } from "@g4rcez/components";
import { useGlobalStore } from "../../store/global.store";
import {
  Shortcut,
  ShortcutItem,
  Type,
  useWritemeShortcuts,
} from "../elements/shortcut-items";

const ShortcutTutorial = (props: {
  shortcuts: Shortcut[];
  title: string;
  description: string;
}) => {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-medium leading-relaxed mb-2">{props.title}</h2>
        <p className="text-foreground/70">{props.description}</p>
      </header>
      <ul className="flex flex-col gap-4">
        {props.shortcuts.map((x) => (
          <ShortcutItem key={x.bind} shortcut={x} />
        ))}
      </ul>
    </div>
  );
};

export const ShortcutsCommands = () => {
  const [state, dispatch] = useGlobalStore();
  const writemeShortcuts = useWritemeShortcuts();
  return (
    <Modal
      title="Shortcuts and commands"
      open={state.help}
      onChange={dispatch.help}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ShortcutTutorial
          title="Shortcuts"
          shortcuts={writemeShortcuts.filter((x) => x.type === Type.Shortcut)}
          description="These shortcuts you can run globally to enable/disable some functions"
        />
        <ShortcutTutorial
          title="Commands"
          shortcuts={writemeShortcuts.filter((x) => x.type === Type.Command)}
          description="These commands you can run in text editor to replace commands to their function results"
        />
      </div>
    </Modal>
  );
};
