import { useState } from "react";
import type { AppSettings } from "@/store/settings";
import { QuickSettingsControls } from "@/app/components/settings/settings-controls";
import { registerGlobalShortcuts, saveSettingsPatch } from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { globalDispatch } from "@/store/global.store";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsQuickPage() {
    const { settings, setSettings } = useSettingsDraft();
    const [saving, setSaving] = useState(false);

    const onPatch = async (patch: Partial<AppSettings>) => {
        if (!settings) return;

        const next = { ...settings, ...patch };
        setSettings(next);
        setSaving(true);
        try {
            const shortcutChanged =
                "quickNoteShortcut" in patch || "mathNoteShortcut" in patch || "floatingEditorShortcut" in patch;
            if (patch.theme) {
                globalDispatch.theme(patch.theme);
            } else if (!shortcutChanged) {
                await saveSettingsPatch(patch);
            }
            if (shortcutChanged) {
                await saveSettingsPatch(patch);
                await registerGlobalShortcuts(next);
            }
        } finally {
            setSaving(false);
        }
    };

    if (!settings) return <div className="p-8">Loading settings...</div>;

    return (
        <SettingsPageShell
            title="Quick Settings"
            description="A compact set of controls for the preferences you change most often. Changes here save immediately."
            actions={saving ? <span className="self-center text-xs text-muted-foreground">Saving...</span> : null}
        >
            <div className="py-2">
                <QuickSettingsControls settings={settings} onPatch={onPatch} />
            </div>
        </SettingsPageShell>
    );
}
