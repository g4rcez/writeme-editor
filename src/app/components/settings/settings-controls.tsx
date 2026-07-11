import type { ChangeEvent, ReactNode } from "react";
import { Select, Checkbox, Input } from "@g4rcez/components";
import type { AppSettings } from "@/store/settings";
import { ShortcutRecorder } from "@/app/components/shortcut-recorder";
import { GLOBAL_THEMES } from "@/app/settings/theme";
import { isElectron } from "@/lib/is-electron";

type SettingsPatch = Partial<AppSettings>;

type SettingsControlsProps = {
    settings: AppSettings;
    onPatch: (patch: SettingsPatch) => void;
    compact?: boolean;
};

type SettingsFieldProps = {
    label: string;
    description: string;
    children: ReactNode;
    compact?: boolean;
};

const TRASH_RETENTION_OPTIONS = [
    { label: "7 days", value: "7" },
    { label: "10 days", value: "10" },
    { label: "30 days", value: "30" },
    { label: "Never", value: "never" },
];

const EDITOR_MODE_OPTIONS = [
    { label: "Rich", value: "rich" },
    { label: "Raw Markdown", value: "raw" },
];

function SettingsField({ label, description, children, compact = false }: SettingsFieldProps) {
    if (compact) {
        return (
            <div className="space-y-2">
                <div>
                    <span className="text-xs font-medium text-foreground">{label}</span>
                    <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
                </div>
                {children}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 py-4 border-b border-card-border last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="sm:min-w-48">{children}</div>
        </div>
    );
}

function parseRetention(value: string): AppSettings["trashRetentionDays"] {
    if (value === "never") return "never";
    if (value === "7") return 7;
    if (value === "30") return 30;
    return 10;
}

export function AppearanceSettingsControls({ settings, onPatch, compact }: SettingsControlsProps) {
    return (
        <SettingsField label="Theme" description="Choose the visual theme used across the editor." compact={compact}>
            <Select
                optionalText=" "
                hiddenLabel={!compact}
                value={settings.theme}
                options={GLOBAL_THEMES}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onPatch({ theme: event.target.value as AppSettings["theme"] })
                }
            />
        </SettingsField>
    );
}

export function TrashSettingsControls({ settings, onPatch, compact }: SettingsControlsProps) {
    return (
        <SettingsField
            label="Auto-purge after"
            description="Permanently delete trashed notes after this period."
            compact={compact}
        >
            <Select
                optionalText=" "
                hiddenLabel={!compact}
                options={TRASH_RETENTION_OPTIONS}
                value={String(settings.trashRetentionDays)}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onPatch({ trashRetentionDays: parseRetention(event.target.value) })
                }
            />
        </SettingsField>
    );
}

export function ShortcutSettingsControls({ settings, onPatch, compact }: SettingsControlsProps) {
    if (!isElectron()) return null;
    return (
        <div className={compact ? "space-y-4" : "contents"}>
            <SettingsField label="Quick Note" description="Open a new quick note from anywhere." compact={compact}>
                <ShortcutRecorder
                    value={settings.quickNoteShortcut}
                    onChange={(quickNoteShortcut) => onPatch({ quickNoteShortcut })}
                />
            </SettingsField>
            <SettingsField
                label="Math Note"
                description="Open a new math note with a ready-to-use math block."
                compact={compact}
            >
                <ShortcutRecorder
                    value={settings.mathNoteShortcut}
                    onChange={(mathNoteShortcut) => onPatch({ mathNoteShortcut })}
                />
            </SettingsField>
        </div>
    );
}

export function EditorSettingsControls({ settings, onPatch }: SettingsControlsProps) {
    return (
        <>
            <SettingsField label="Autosave" description="Automatically save changes while typing.">
                <Checkbox
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
                        mask="int"
                        hiddenLabel
                        container="w-28"
                        value={settings.autosaveDelay.toString()}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            onPatch({
                                autosaveDelay: parseInt(event.target.value, 10) || 1000,
                            })
                        }
                    />
                </SettingsField>
            ) : null}
            <SettingsField
                label="Default editor mode"
                description="Choose whether notes open in the rich editor or raw Markdown."
            >
                <Select
                    optionalText=" "
                    hiddenLabel
                    value={settings.editorMode}
                    options={EDITOR_MODE_OPTIONS}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                        onPatch({
                            editorMode: event.target.value as AppSettings["editorMode"],
                        })
                    }
                />
            </SettingsField>
            <SettingsField label="Raw editor Vim mode" description="Enable Vim keybindings when editing raw Markdown.">
                <Checkbox
                    checked={settings.rawEditorVimMode}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        onPatch({ rawEditorVimMode: event.target.checked })
                    }
                />
            </SettingsField>
            <SettingsField label="Editor font size" description="Base font size used by the note editor.">
                <Input
                    mask="int"
                    hiddenLabel
                    container="w-28"
                    value={settings.editorFontSize.toString()}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        onPatch({ editorFontSize: parseInt(event.target.value, 10) || 16 })
                    }
                />
            </SettingsField>
        </>
    );
}

export function QuickSettingsControls({ settings, onPatch, compact = false }: SettingsControlsProps) {
    return (
        <div className={compact ? "space-y-5" : "divide-y-0"}>
            <AppearanceSettingsControls settings={settings} onPatch={onPatch} compact={compact} />
            <TrashSettingsControls settings={settings} onPatch={onPatch} compact={compact} />
            <ShortcutSettingsControls settings={settings} onPatch={onPatch} compact={compact} />
        </div>
    );
}
