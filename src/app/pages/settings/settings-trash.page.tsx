import { Button } from "@g4rcez/components";
import { useState } from "react";
import { TrashSettingsControls } from "@/app/components/settings/settings-controls";
import { saveSettingsPatch } from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { uiDispatch } from "@/store/ui.store";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsTrashPage() {
  const { settings, patchSettings } = useSettingsDraft();
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettingsPatch({
        trashRetentionDays: settings.trashRetentionDays,
      });
      uiDispatch.setAlert({
        open: true,
        message: "Trash settings saved.",
        type: "success",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="p-8">Loading settings...</div>;

  return (
    <SettingsPageShell
      title="Trash"
      description="Decide how long deleted notes stay recoverable before permanent purge."
      actions={
        <Button size="small" disabled={saving} onClick={onSave}>
          {saving ? "Saving..." : "Save Trash"}
        </Button>
      }
    >
      <TrashSettingsControls settings={settings} onPatch={patchSettings} />
    </SettingsPageShell>
  );
}
