import { isElectron } from "@/lib/is-electron";
import {
  Button,
  Card,
  Checkbox,
  Info,
  Input,
  Select,
} from "@g4rcez/components";
import { SaveIcon, SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { globalDispatch } from "../../store/global.store";
import { AppSettings, SettingsService } from "../../store/settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(SettingsService.load());
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await SettingsService.save(settings);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (theme: "light" | "dark") => {
    if (!settings) return;
    setSettings({ ...settings, theme });
    globalDispatch.theme(theme);
  };

  if (!settings) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="py-4 mx-auto space-y-6 w-full max-w-safe">
      <header className="flex justify-between items-center px-4">
        <h1 className="flex gap-2 items-center text-3xl font-bold">
          <SettingsIcon className="size-8" />
          Settings
        </h1>
        <Button
          size="small"
          disabled={saving}
          onClick={handleSave}
          className="flex gap-2 items-center"
        >
          <SaveIcon size={16} />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </header>

      <div className="flex flex-col gap-6 px-4">
        <Card title="Editor" className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <Info label="Autosave" className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Automatically save changes while typing
              </p>
            </Info>
            <Checkbox
              checked={settings.autosave}
              onChange={(e) =>
                setSettings({ ...settings, autosave: e.target.checked })
              }
            />
          </div>

          {settings.autosave && (
            <Info label="Autosave delay">
              <div className="flex flex-row gap-1 justify-between items-center w-full">
                <p className="text-sm text-muted-foreground">
                  Milliseconds to wait after last keystroke before saving
                </p>
                <Input
                  mask="int"
                  hiddenLabel
                  container="w-20"
                  value={settings.autosaveDelay.toString()}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autosaveDelay: parseInt(e.target.value) || 1000,
                    })
                  }
                />
              </div>
            </Info>
          )}
        </Card>

        <Card title="Appearance">
          <div className="flex justify-between items-center py-2">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Theme</span>
              <p className="text-sm text-muted-foreground">
                Choose your preferred editor theme
              </p>
            </div>
            <Select
              hiddenLabel
              value={settings.theme}
              onChange={(e) =>
                handleThemeChange(e.target.value as "light" | "dark")
              }
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
        </Card>

        {isElectron() ? (
          <Card title="Workspace">
            <div className="flex flex-col gap-2">
              <span className="font-medium">Current Directory</span>
              <code className="block p-2 text-xs whitespace-pre-wrap break-all rounded bg-muted">
                {settings.directory || "No directory selected (Local Storage)"}
              </code>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
