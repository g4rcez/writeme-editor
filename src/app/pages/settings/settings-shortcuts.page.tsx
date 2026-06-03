import { Button } from "@g4rcez/components";
import { useState } from "react";
import { ShortcutSettingsControls } from "@/app/components/settings/settings-controls";
import {
  registerGlobalShortcuts,
  saveSettingsPatch,
} from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { uiDispatch } from "@/store/ui.store";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsShortcutsPage() {
  const { settings, patchSettings } = useSettingsDraft();
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettingsPatch({
        quickNoteShortcut: settings.quickNoteShortcut,
        mathNoteShortcut: settings.mathNoteShortcut,
      });
      const success = await registerGlobalShortcuts(settings);
      if (success) {
        uiDispatch.setAlert({
          open: true,
          message: "Shortcut settings saved.",
          type: "success",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="p-8">Loading settings...</div>;

  return (
    <SettingsPageShell
      title="Shortcuts"
      description="Edit the global shortcuts that open quick capture windows."
      actions={
        <Button size="small" disabled={saving} onClick={onSave}>
          {saving ? "Saving..." : "Save Shortcuts"}
        </Button>
      }
    >
      <ShortcutSettingsControls settings={settings} onPatch={patchSettings} />
    </SettingsPageShell>
  );
}
