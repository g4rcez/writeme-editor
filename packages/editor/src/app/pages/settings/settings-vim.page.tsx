import { Button, Checkbox } from "@g4rcez/components";
import { useState } from "react";
import { saveSettingsPatch } from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { EXAMPLE_VIM_INIT } from "@/app/vim/configuration";
import { loadVimConfiguration } from "@/app/vim/load-configuration";
import { FEATURES } from "@/lib/build-features";
import { SettingsPageShell } from "./settings-page-shell";

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
        <SettingsPageShell
            title="Vim"
            description="One Vim configuration for formatted and Markdown editors."
            actions={
                <Button size="small" disabled={busy} onClick={() => void validate(true)}>
                    {busy ? "Saving..." : "Save Vim"}
                </Button>
            }
        >
            <Checkbox
                disabled={busy}
                checked={settings.vimMode}
                onChange={(event) => patchSettings({ vimMode: event.target.checked })}
            >
                Enable Vim mode in all editors
            </Checkbox>
            {FEATURES.vimScripts ? (
                <div className="mt-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label htmlFor="vim-init" className="font-medium text-foreground">
                            Global init.ts
                        </label>
                        <div className="flex gap-2">
                            <Button
                                size="small"
                                theme="ghost-muted"
                                disabled={busy}
                                onClick={() => {
                                    patchSettings({ vimConfig: EXAMPLE_VIM_INIT });
                                    setMessage("");
                                    setError("");
                                }}
                            >
                                Load example
                            </Button>
                            <Button
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
                        default bindings. Changes take effect when saved.
                    </p>
                    <textarea
                        id="vim-init"
                        aria-describedby="vim-init-help"
                        aria-invalid={Boolean(error)}
                        value={settings.vimConfig}
                        placeholder="// Empty init.ts uses the default bindings."
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        rows={18}
                        maxLength={50_000}
                        disabled={busy}
                        className="w-full resize-y rounded-md border border-card-border bg-card-background p-4 font-mono text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        onChange={(event) => {
                            patchSettings({ vimConfig: event.target.value });
                            setError("");
                            setMessage("");
                        }}
                    />
                    <p className="text-sm text-muted-foreground">
                        <code>vim.opt.leader</code>, <code>vim.opt.timeout</code>, <code>vim.opt.initialMode</code>.
                        Mappings support normal, insert, and visual modes; actions are Vim key sequences.
                    </p>
                </div>
            ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                    TypeScript customization is unavailable in this build. Built-in Vim keybindings remain available in
                    both editors.
                </p>
            )}
            {error ? (
                <p role="alert" className="mt-4 text-danger">
                    {error}
                </p>
            ) : null}
            <output aria-live="polite" className="mt-4 block text-sm text-muted-foreground">
                {message}
            </output>
        </SettingsPageShell>
    );
}
