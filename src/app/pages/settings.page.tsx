import { isElectron } from "@/lib/is-electron";
import {
  Button,
  Card,
  Checkbox,
  Info,
  Autocomplete,
  Input,
} from "@g4rcez/components";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { useEffect, useState, useRef } from "react";
import { startMigration, importFromFile } from "@/lib/data-migration";
import { globalDispatch } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { type AppSettings, SettingsService } from "@/store/settings";
import { CustomVariables } from "@/app/components/settings/custom-variables";
import { GLOBAL_THEMES } from "../settings/theme";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [, uiDispatch] = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(SettingsService.load());
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await SettingsService.save(settings);
      uiDispatch.setAlert({
        open: true,
        message: "Settings saved successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      uiDispatch.setAlert({
        open: true,
        message: "Failed to save settings.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (theme: "light" | "dark" | "catppuccin-mocha") => {
    if (!settings) return;
    setSettings({ ...settings, theme });
    globalDispatch.theme(theme);
  };

  if (!settings) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="py-4 pb-20 mx-auto space-y-6 w-full max-w-safe">
      <header className="flex justify-between items-center px-4">
        <h1 className="flex gap-2 items-center text-3xl font-bold">
          <GearIcon className="size-8" />
          Settings
        </h1>
        <Button
          size="small"
          disabled={saving}
          onClick={handleSave}
          className="flex gap-2 items-center"
        >
          <FloppyDiskIcon size={16} />
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
            <Autocomplete
              hiddenLabel
              value={settings.theme}
              options={GLOBAL_THEMES}
              onChange={(e) =>
                handleThemeChange(
                  e.target.value as "light" | "dark" | "catppuccin-mocha",
                )
              }
            />
          </div>
        </Card>
        <CustomVariables />
        {!isElectron() ? (
          <Card title="Domain Migration">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Moved from <strong>www.writeme.dev</strong>? Import your notes,
                tabs, hashtags, settings, and scripts from the old domain.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="small"
                  disabled={migrating}
                  onClick={async () => {
                    setMigrating(true);
                    try {
                      const counts = await startMigration();
                      uiDispatch.setAlert({
                        open: true,
                        message: `Migrated ${counts.notes} notes, ${counts.tabs} tabs, ${counts.settings} settings, ${counts.hashtags} hashtags, ${counts.scripts} scripts.`,
                        type: "success",
                      });
                    } catch (err) {
                      uiDispatch.setAlert({
                        open: true,
                        message:
                          err instanceof Error
                            ? err.message
                            : "Migration failed.",
                        type: "error",
                      });
                    } finally {
                      setMigrating(false);
                    }
                  }}
                >
                  {migrating ? "Migrating..." : "Migrate from www.writeme.dev"}
                </Button>
                <Button
                  size="small"
                  theme="ghost-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import from file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = "";
                    try {
                      const counts = await importFromFile(file);
                      uiDispatch.setAlert({
                        open: true,
                        message: `Imported ${counts.notes} notes, ${counts.tabs} tabs, ${counts.settings} settings, ${counts.hashtags} hashtags, ${counts.scripts} scripts.`,
                        type: "success",
                      });
                    } catch (err) {
                      uiDispatch.setAlert({
                        open: true,
                        message:
                          err instanceof Error ? err.message : "Import failed.",
                        type: "error",
                      });
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        ) : null}
        {isElectron() ? (
          <Card title="Workspace">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Notes Directory</span>
                  <code className="block p-2 whitespace-pre-wrap break-all rounded border text-[10px] bg-muted border-border/40">
                    {settings.directory ||
                      "No directory selected (Local Storage)"}
                  </code>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Templates Directory
                    </span>
                    <Button
                      size="small"
                      theme="ghost-primary"
                      onClick={async () => {
                        const dir =
                          await window.electronAPI.fs.chooseDirectory();
                        if (dir) {
                          setSettings({ ...settings, templatesDirectory: dir });
                        }
                      }}
                    >
                      Change Folder
                    </Button>
                  </div>
                  <code className="block p-2 whitespace-pre-wrap break-all rounded border text-[10px] bg-muted border-border/40">
                    {settings.templatesDirectory ||
                      "Default (.templates in workspace)"}
                  </code>
                  <p className="text-[10px] text-muted-foreground">
                    Custom folder where your .md templates are stored. Each file
                    can use {"{{VARIABLE}}"} syntax.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Quick Notes Directory
                    </span>
                    <Button
                      size="small"
                      theme="ghost-primary"
                      onClick={async () => {
                        const dir =
                          await window.electronAPI.fs.chooseDirectory();
                        if (dir) {
                          setSettings({
                            ...settings,
                            quicknotesDirectory: dir,
                          });
                        }
                      }}
                    >
                      Change Folder
                    </Button>
                  </div>
                  <code className="block p-2 whitespace-pre-wrap break-all rounded border text-[10px] bg-muted border-border/40">
                    {settings.quicknotesDirectory ||
                      (settings.directory
                        ? `${settings.directory}/quicknotes`
                        : "Default (quicknotes in workspace)")}
                  </code>
                  <p className="text-[10px] text-muted-foreground">
                    Folder where quick notes are saved. Defaults to a{" "}
                    <code className="text-primary">quicknotes</code>{" "}
                    subdirectory inside your workspace.
                  </p>
                </div>
              </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
