import { Modal } from "@g4rcez/components";
import { mapShortcutOS } from "@/app/elements/shortcut-items";
import { isElectron } from "@/lib/is-electron";
import { useGlobalStore } from "@/store/global.store";
import { SettingsService } from "@/store/settings";
import { type CommandReferenceItem, getCommandReference } from "./command-reference";

function CommandReferenceRow({ item }: { item: CommandReferenceItem }) {
    const trigger = item.category === "Keyboard" ? mapShortcutOS(item.trigger) : item.trigger;

    return (
        <li className="flex flex-col gap-3 border-b border-card-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {item.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.context}</span>
                </div>
                <p className="text-sm text-foreground">{item.description}</p>
            </div>
            <kbd className="w-fit shrink-0 rounded border border-border bg-background px-3 py-2 font-mono text-sm text-foreground sm:max-w-72">
                {trigger}
            </kbd>
        </li>
    );
}

export function ShortcutsCommands() {
    const [state, dispatch] = useGlobalStore();
    const commands = getCommandReference({
        isDesktopApp: isElectron(),
        settings: SettingsService.load(),
    });

    return (
        <Modal
            type="dialog"
            className="max-w-4xl"
            title="All shortcuts and commands"
            open={state.help}
            onChange={dispatch.help}
        >
            <ul aria-label="Shortcuts and commands" className="flex flex-col">
                {commands.map((item, index) => (
                    <CommandReferenceRow
                        key={`${item.category}-${item.context}-${item.trigger}-${index}`}
                        item={item}
                    />
                ))}
            </ul>
        </Modal>
    );
}
