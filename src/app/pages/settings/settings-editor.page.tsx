import { Button } from "@g4rcez/components";
import { useState } from "react";
import { EditorSettingsControls } from "@/app/components/settings/settings-controls";
import { saveSettingsPatch } from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { globalDispatch } from "@/store/global.store";
import { uiDispatch } from "@/store/ui.store";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsEditorPage() {
    const { settings, patchSettings } = useSettingsDraft();
    const [saving, setSaving] = useState(false);

    const onSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await saveSettingsPatch({
                autosave: settings.autosave,
                autosaveDelay: settings.autosaveDelay,
                editorMode: settings.editorMode,
                rawEditorVimMode: settings.rawEditorVimMode,
                editorFontSize: settings.editorFontSize,
            });
            globalDispatch.setEditorFontSize(settings.editorFontSize);
            uiDispatch.setAlert({
                open: true,
                message: "Editor settings saved.",
                type: "success",
            });
        } finally {
            setSaving(false);
        }
    };

    if (!settings) return <div className="p-8">Loading settings...</div>;

    return (
        <SettingsPageShell
            title="Editor"
            description="Tune autosave behavior, raw editing, and the editor reading size."
            actions={
                <Button size="small" disabled={saving} onClick={onSave}>
                    {saving ? "Saving..." : "Save Editor"}
                </Button>
            }
        >
            <EditorSettingsControls settings={settings} onPatch={patchSettings} />
        </SettingsPageShell>
    );
}
