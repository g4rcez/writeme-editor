import { Button, Checkbox } from "@g4rcez/components";
import { useState } from "react";
import { saveSettingsPatch } from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { EXAMPLE_VIM_INIT } from "@/app/vim/configuration";
import { loadVimConfiguration } from "@/app/vim/load-configuration";
import { VimConfigurationEditor } from "@/app/vim/scripts/configuration-editor";
import { FEATURES } from "@/lib/build-features";
import { SettingsPageShell } from "./settings-page-shell";

const DEFAULT_MOTIONS = [
    { keys: ["h", "j", "k", "l"], description: "Move left, down, up, and right." },
    { keys: ["w", "W"], description: "Move to the next word start; W treats punctuation as part of a word." },
    { keys: ["b", "B"], description: "Move to the previous word start; B treats punctuation as part of a word." },
    { keys: ["e", "E"], description: "Move to a word end; E treats punctuation as part of a word." },
    { keys: ["0", "^", "$"], description: "Move to line start, first nonblank character, or line end." },
    { keys: ["gg", "G"], description: "Move to the first or last document line. A count selects a line number." },
    { keys: ["gj", "gk"], description: "Move down or up one wrapped screen line." },
    { keys: ["{", "}"], description: "Move to the previous or next text block." },
    { keys: ["f{char}", "F{char}"], description: "Find a character forward or backward on the current line." },
    { keys: ["t{char}", "T{char}"], description: "Move until just before or after a character on the current line." },
    { keys: [";", ","], description: "Repeat the last character find forward or in reverse." },
] as const;

export default function SettingsVimPage(): React.JSX.Element {
    const { settings, patchSettings } = useSettingsDraft();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const validate = async (save: boolean): Promise<void> => {
        if (!settings) return;
        setBusy(true);
        setError("");
        setMessage(FEATURES.vimScripts ? "Validating init.ts..." : "Saving Vim settings...");
        try {
            if (FEATURES.vimScripts) await loadVimConfiguration(settings.vimConfig);
            if (save)
                await saveSettingsPatch({
                    vimMode: settings.vimMode,
                    ...(FEATURES.vimScripts ? { vimConfig: settings.vimConfig } : {}),
                });
            setMessage(save ? "Vim settings saved for all editors." : "init.ts is valid.");
        } catch (reason) {
            setMessage("");
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setBusy(false);
        }
    };

    if (!settings) return <output className="p-8">Loading Vim settings...</output>;
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (!busy) void validate(true);
            }}
            onKeyDownCapture={(event) => {
                if (
                    !(event.ctrlKey || event.metaKey) ||
                    event.altKey ||
                    event.shiftKey ||
                    event.key.toLowerCase() !== "s"
                )
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (!busy && !event.repeat) void validate(true);
            }}
        >
            <SettingsPageShell
                title="Vim"
                description="One Vim configuration for formatted and Markdown editors."
                actions={
                    <Button type="submit" size="small" disabled={busy}>
                        {busy ? "Saving..." : "Save Vim"}
                    </Button>
                }
            >
                {error ? (
                    <p id="vim-init-error" role="alert" className="mb-4 text-danger">
                        Configuration was not saved: {error}
                    </p>
                ) : null}
                <output aria-live="polite" className="mb-4 block text-sm text-muted-foreground">
                    {message}
                </output>
                <Checkbox
                    disabled={busy}
                    checked={settings.vimMode}
                    onChange={(event) => {
                        patchSettings({ vimMode: event.target.checked });
                        setMessage("Unsaved changes.");
                    }}
                >
                    Enable Vim mode in all editors
                </Checkbox>
                <section aria-label="Built-in Vim motions" className="mt-6 rounded-lg border border-border">
                    <details>
                        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <span>Default motions</span>
                            <span className="text-xs font-normal text-muted-foreground">
                                {DEFAULT_MOTIONS.length} groups
                            </span>
                        </summary>
                        <div className="border-t border-border px-4 py-3">
                            <p className="mb-3 text-sm leading-5 text-muted-foreground">
                                Counts work with motions. In Normal mode, prefix a motion with <kbd>d</kbd>,{" "}
                                <kbd>c</kbd>, or <kbd>y</kbd> to delete, change, or yank its range.
                            </p>
                            <dl className="grid gap-x-6 sm:grid-cols-2">
                                {DEFAULT_MOTIONS.map(({ keys, description }) => (
                                    <div
                                        key={keys.join("-")}
                                        className="grid grid-cols-[minmax(5rem,auto)_1fr] items-start gap-3 border-t border-border/60 py-2.5 first:border-t-0 sm:first:border-t"
                                    >
                                        <dt className="flex flex-wrap gap-1.5">
                                            {keys.map((key) => (
                                                <kbd
                                                    key={key}
                                                    className="rounded border border-border bg-secondary-background px-1.5 py-0.5 font-mono text-xs text-foreground"
                                                >
                                                    {key}
                                                </kbd>
                                            ))}
                                        </dt>
                                        <dd className="text-sm leading-5 text-muted-foreground">{description}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </details>
                </section>
                {FEATURES.vimScripts ? (
                    <div className="mt-6 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span id="vim-init-label" className="font-medium text-foreground">
                                Global init.ts
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="small"
                                    theme="ghost-muted"
                                    disabled={busy}
                                    onClick={() => {
                                        patchSettings({ vimConfig: EXAMPLE_VIM_INIT });
                                        setMessage("Unsaved changes.");
                                        setError("");
                                    }}
                                >
                                    Load example
                                </Button>
                                <Button
                                    type="button"
                                    size="small"
                                    theme="ghost-muted"
                                    disabled={busy}
                                    onClick={() => void validate(false)}
                                >
                                    Validate
                                </Button>
                            </div>
                        </div>
                        <p id="vim-init-help" className="text-sm text-muted-foreground">
                            Use TypeScript helpers and vim.keymap.set to configure both editors. An empty file restores
                            default bindings. Save with the button or Ctrl/Cmd+S. Press Ctrl+Space for completion.
                        </p>
                        <VimConfigurationEditor
                            value={settings.vimConfig}
                            disabled={busy}
                            invalid={Boolean(error)}
                            onChange={(source) => {
                                patchSettings({ vimConfig: source });
                                setError("");
                                setMessage("Unsaved changes.");
                            }}
                        />
                        <p className="text-sm text-muted-foreground">
                            <code>vim.opt.leader</code>, <code>vim.opt.timeout</code>, <code>vim.opt.initialMode</code>.
                            Mappings support normal, insert, and visual modes; actions are Vim key sequences.
                        </p>
                    </div>
                ) : (
                    <p className="mt-6 text-sm text-muted-foreground">
                        TypeScript customization is unavailable in this build. Built-in Vim keybindings remain available
                        in both editors.
                    </p>
                )}
            </SettingsPageShell>
        </form>
    );
}
