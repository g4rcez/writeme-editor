import type { ChangeEvent, JSX, ReactNode } from "react";
import { Select, Checkbox, Input } from "@g4rcez/components";
import type { AppSettings } from "@/store/settings";
import { ShortcutRecorder } from "@/app/components/shortcut-recorder";
import { GLOBAL_THEMES } from "@/app/settings/theme";
import { isElectron } from "@/lib/is-electron";

type SettingsPatch = Partial<AppSettings>;

type SettingsControlsProps = {
    settings: AppSettings;
    onPatch: (patch: SettingsPatch) => void;
};

type SettingsFieldProps = {
    label: string;
    description: string;
    children: ReactNode;
};

const TRASH_RETENTION_OPTIONS = [
    { label: "7 days", value: "7" },
    { label: "10 days", value: "10" },
    { label: "30 days", value: "30" },
    { label: "Never", value: "never" },
];

const EDITOR_MODE_OPTIONS = [
    { label: "Formatted", value: "formatted" },
    { label: "Markdown", value: "markdown" },
];

function SettingsField({ label, description, children }: SettingsFieldProps): JSX.Element {
    return (
        <div className="grid min-w-0 gap-3 border-b border-border/40 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center sm:gap-8">
            <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0 sm:justify-self-end">{children}</div>
        </div>
    );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }): JSX.Element {
    return (
        <section>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {children}
        </section>
    );
}

function parseRetention(value: string): AppSettings["trashRetentionDays"] {
    if (value === "never") return "never";
    if (value === "7") return 7;
    if (value === "30") return 30;
    return 10;
}

export function AppearanceSettingsControls({ settings, onPatch }: SettingsControlsProps): JSX.Element {
    return (
        <SettingsField label="Theme" description="Choose the visual theme used across the editor.">
            <Select
                title="Theme"
                aria-label="Theme"
                optionalText=" "
                hiddenLabel
                container="w-full sm:w-56"
                value={settings.theme}
                options={GLOBAL_THEMES}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onPatch({ theme: event.target.value as AppSettings["theme"] })
                }
            />
        </SettingsField>
    );
}

export function TrashSettingsControls({ settings, onPatch }: SettingsControlsProps): JSX.Element | null {
    if (!isElectron()) return null;
    return (
        <SettingsField label="Auto-purge after" description="Permanently delete trashed notes after this period.">
            <Select
                title="Auto-purge after"
                aria-label="Auto-purge after"
                optionalText=" "
                hiddenLabel
                container="w-full sm:w-56"
                options={TRASH_RETENTION_OPTIONS}
                value={String(settings.trashRetentionDays)}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onPatch({ trashRetentionDays: parseRetention(event.target.value) })
                }
            />
        </SettingsField>
    );
}

export function ShortcutSettingsControls({ settings, onPatch }: SettingsControlsProps): JSX.Element | null {
    if (!isElectron()) return null;
    return (
        <>
            <SettingsField label="Quick Note" description="Open a new quick note from anywhere.">
                <ShortcutRecorder
                    label="Quick Note shortcut"
                    value={settings.quickNoteShortcut}
                    onChange={(quickNoteShortcut) => onPatch({ quickNoteShortcut })}
                />
            </SettingsField>
            <SettingsField label="Math Note" description="Open a new math note with a ready-to-use math block.">
                <ShortcutRecorder
                    label="Math Note shortcut"
                    value={settings.mathNoteShortcut}
                    onChange={(mathNoteShortcut) => onPatch({ mathNoteShortcut })}
                />
            </SettingsField>
            <SettingsField label="Floating Editor" description="Open a new editor window without the sidebar or tabs.">
                <ShortcutRecorder
                    label="Floating Editor shortcut"
                    value={settings.floatingEditorShortcut}
                    onChange={(floatingEditorShortcut) => onPatch({ floatingEditorShortcut })}
                />
            </SettingsField>
        </>
    );
}

export function EditorSettingsControls({ settings, onPatch }: SettingsControlsProps): JSX.Element {
    return (
        <div className="space-y-8">
            <SettingsGroup title="Writing experience">
                <SettingsField
                    label="Default editor mode"
                    description="Choose whether notes open in the formatted editor or Markdown."
                >
                    <Select
                        title="Default editor mode"
                        aria-label="Default editor mode"
                        optionalText=" "
                        hiddenLabel
                        container="w-full sm:w-56"
                        value={settings.editorMode}
                        options={EDITOR_MODE_OPTIONS}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            onPatch({ editorMode: event.target.value as AppSettings["editorMode"] })
                        }
                    />
                </SettingsField>
                <SettingsField label="Editor font size" description="Base font size used by the note editor.">
                    <Input
                        title="Editor font size"
                        aria-label="Editor font size"
                        mask="int"
                        hiddenLabel
                        container="w-28"
                        right={<span className="text-xs text-muted-foreground">px</span>}
                        value={settings.editorFontSize.toString()}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            onPatch({ editorFontSize: parseInt(event.target.value, 10) || 16 })
                        }
                    />
                </SettingsField>
                <SettingsField
                    label="Vim mode"
                    description="Enable Vim keybindings in both formatted and Markdown notes."
                >
                    <Checkbox
                        aria-label="Vim mode"
                        checked={settings.vimMode}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onPatch({ vimMode: event.target.checked })}
                    />
                </SettingsField>
            </SettingsGroup>
            <SettingsGroup title="Saving">
                <SettingsField label="Autosave" description="Automatically save changes while typing.">
                    <Checkbox
                        aria-label="Autosave"
                        checked={settings.autosave}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onPatch({ autosave: event.target.checked })}
                    />
                </SettingsField>
                {settings.autosave ? (
                    <SettingsField
                        label="Autosave delay"
                        description="Milliseconds to wait after the last keystroke before saving."
                    >
                        <Input
                            title="Autosave delay"
                            aria-label="Autosave delay"
                            mask="int"
                            hiddenLabel
                            container="w-28"
                            right={<span className="text-xs text-muted-foreground">ms</span>}
                            value={settings.autosaveDelay.toString()}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                onPatch({ autosaveDelay: parseInt(event.target.value, 10) || 1000 })
                            }
                        />
                    </SettingsField>
                ) : null}
            </SettingsGroup>
        </div>
    );
}

export function QuickSettingsControls({ settings, onPatch }: SettingsControlsProps): JSX.Element {
    return (
        <div className="space-y-8">
            <AppearanceSettingsControls settings={settings} onPatch={onPatch} />
            {isElectron() ? (
                <>
                    <SettingsGroup title="Quick capture">
                        <ShortcutSettingsControls settings={settings} onPatch={onPatch} />
                    </SettingsGroup>
                    <SettingsGroup title="Deleted notes">
                        <TrashSettingsControls settings={settings} onPatch={onPatch} />
                    </SettingsGroup>
                </>
            ) : null}
        </div>
    );
}
