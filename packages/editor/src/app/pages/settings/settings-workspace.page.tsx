import { Button } from "@g4rcez/components";
import { useState } from "react";
import { ObsidianImporter } from "@/app/components/obsidian-importer";
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

    if (!settings)
        return (
            <p role="status" className="text-sm text-muted-foreground">
                Loading settings...
            </p>
        );

    return (
        <SettingsPageShell
            title="Workspace"
            description="Review your notes workspace and choose folders for templates and quick notes."
            actions={
                saving ? (
                    <span role="status" className="self-center text-sm text-muted-foreground">
                        Saving...
                    </span>
                ) : null
            }
        >
            <div className="divide-y divide-border">
                <WorkspacePath
                    label="Notes Directory"
                    value={settings.directory || "No directory selected (Local Storage)"}
                />
                <WorkspacePath
                    label="Templates Directory"
                    value={settings.templatesDirectory || "Default (.templates in workspace)"}
                    action={
                        <Button
                            size="small"
                            theme="ghost-primary"
                            disabled={saving}
                            aria-label="Change Folder for Templates Directory"
                            onClick={chooseTemplatesDirectory}
                        >
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
                        <Button
                            size="small"
                            theme="ghost-primary"
                            disabled={saving}
                            aria-label="Change Folder for Quick Notes Directory"
                            onClick={chooseQuicknotesDirectory}
                        >
                            Change Folder
                        </Button>
                    }
                    description="Folder where quick notes are saved. Defaults to a quicknotes subdirectory inside your workspace."
                />
                <ObsidianImporter destinationDirectory={settings.directory || null} />
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
        <section className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" aria-label={label}>
            <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-medium text-foreground">{label}</h2>
                <p className="break-all text-sm leading-6 text-foreground">{value}</p>
                {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
            </div>
            {action ? <div className="justify-self-start sm:justify-self-end">{action}</div> : null}
        </section>
    );
}
