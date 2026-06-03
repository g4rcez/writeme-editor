import { Button } from "@g4rcez/components";
import { useState } from "react";
import { AppearanceSettingsControls } from "@/app/components/settings/settings-controls";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { globalDispatch } from "@/store/global.store";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsAppearancePage() {
  const { settings, patchSettings } = useSettingsDraft();
  const [saving, setSaving] = useState(false);

  const onSave = () => {
    if (!settings) return;
    setSaving(true);
    globalDispatch.theme(settings.theme);
    setSaving(false);
  };

  if (!settings) return <div className="p-8">Loading settings...</div>;

  return (
    <SettingsPageShell
      title="Appearance"
      description="Control the visual theme used throughout Writeme."
      actions={
        <Button size="small" disabled={saving} onClick={onSave}>
          {saving ? "Saving..." : "Save Appearance"}
        </Button>
      }
    >
      <AppearanceSettingsControls settings={settings} onPatch={patchSettings} />
    </SettingsPageShell>
  );
}
