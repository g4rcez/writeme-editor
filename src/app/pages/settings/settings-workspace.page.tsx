import { Button } from "@g4rcez/components";
import { useState } from "react";
import { saveSettingsPatch } from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsWorkspacePage() {
    const { settings, patchSettings } = useSettingsDraft();
    const [saving, setSaving] = useState(false);

    const chooseTemplatesDirectory = async () => {
        if (!settings) return;
        const templatesDirectory = await window.electronAPI.fs.chooseDirectory();
        if (!templatesDirectory) return;
        setSaving(true);
        try {
            await saveSettingsPatch({ templatesDirectory });
            patchSettings({ templatesDirectory });
        } finally {
            setSaving(false);
        }
    };

    const chooseQuicknotesDirectory = async () => {
        if (!settings) return;
        const quicknotesDirectory = await window.electronAPI.fs.chooseDirectory();
        if (!quicknotesDirectory) return;
        setSaving(true);
        try {
            await saveSettingsPatch({ quicknotesDirectory });
            patchSettings({ quicknotesDirectory });
        } finally {
            setSaving(false);
        }
    };

    if (!settings) return <div className="p-8">Loading settings...</div>;

    return (
        <SettingsPageShell
            title="Workspace"
            description="Review your notes workspace and choose folders for templates and quick notes."
            actions={saving ? <span className="self-center text-xs text-muted-foreground">Saving...</span> : null}
        >
            <div className="divide-y divide-border/30">
                <WorkspacePath
                    label="Notes Directory"
                    value={settings.directory || "No directory selected (Local Storage)"}
                />
                <WorkspacePath
                    label="Templates Directory"
                    value={settings.templatesDirectory || "Default (.templates in workspace)"}
                    action={
                        <Button size="small" theme="ghost-primary" onClick={chooseTemplatesDirectory}>
                            Change Folder
                        </Button>
                    }
                    description="Custom folder where your .md templates are stored. Each file can use {{VARIABLE}} syntax."
                />
                <WorkspacePath
                    label="Quick Notes Directory"
                    value={
                        settings.quicknotesDirectory ||
                        (settings.directory ? `${settings.directory}/quicknotes` : "Default (quicknotes in workspace)")
                    }
                    action={
                        <Button size="small" theme="ghost-primary" onClick={chooseQuicknotesDirectory}>
                            Change Folder
                        </Button>
                    }
                    description="Folder where quick notes are saved. Defaults to a quicknotes subdirectory inside your workspace."
                />
            </div>
        </SettingsPageShell>
    );
}

type WorkspacePathProps = {
    label: string;
    value: string;
    description?: string;
    action?: React.ReactNode;
};

function WorkspacePath({ label, value, description, action }: WorkspacePathProps) {
    return (
        <div className="py-4">
            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {action}
            </div>
            <code className="block rounded border border-border/50 bg-muted/20 p-2 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                {value}
            </code>
            {description ? <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{description}</p> : null}
        </div>
    );
}
