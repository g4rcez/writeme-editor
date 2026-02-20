import { isElectron } from "@/lib/is-electron";
import {
  Button,
  Card,
  Checkbox,
  Info,
  Select,
  Input,
  Textarea,
  uuid,
  Modal,
} from "@g4rcez/components";
import {
  Save,
  Settings,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState, Fragment } from "react";
import { globalDispatch, repositories } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { AppSettings, SettingsService } from "@/store/settings";
import { AIConfig } from "@/store/repositories/electron/ai.repository";
import { CustomVariables } from "@/app/components/settings/custom-variables";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [, uiDispatch] = useUIStore();

  useEffect(() => {
    setSettings(SettingsService.load());
    if (isElectron()) {
      loadAIConfigs();
    }
  }, []);

  const loadAIConfigs = async () => {
    const configs = await repositories.ai.getConfigs();
    setAiConfigs(configs);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await SettingsService.save(settings);

      if (isElectron()) {
        for (const config of aiConfigs) {
          await repositories.ai.saveConfig(config);
        }
      }

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

  const handleAddAIConfig = () => {
    const now = new Date().toISOString();
    const newConfig: AIConfig = {
      id: uuid(),
      name: "New AI Configuration",
      commandTemplate: 'ollama run llama3 "{{prompt}}"',
      systemPrompt: "You are a helpful assistant.",
      isDefault: aiConfigs.length === 0,
      createdAt: now,
      updatedAt: now,
    };
    setAiConfigs([...aiConfigs, newConfig]);
  };

  const handleDeleteAIConfig = async (id: string) => {
    const confirmed = await Modal.confirm({
      title: "Delete AI Configuration",
      description: "Are you sure you want to delete this configuration?",
      confirm: {
        text: "Delete",
        theme: "danger",
      },
    });

    if (confirmed) {
      setAiConfigs(aiConfigs.filter((c) => c.id !== id));
      if (isElectron()) {
        await repositories.ai.deleteConfig(id);
      }
    }
  };

  const handleUpdateAIConfig = (id: string, updates: Partial<AIConfig>) => {
    setAiConfigs(
      aiConfigs.map((c) =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c,
      ),
    );
  };

  const handleThemeChange = (theme: "light" | "dark") => {
    if (!settings) return;
    setSettings({ ...settings, theme });
    globalDispatch.theme(theme);
  };

  if (!settings) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="py-4 pb-20 mx-auto space-y-6 w-full max-w-safe">
      <header className="flex justify-between items-center px-4">
        <h1 className="flex gap-2 items-center text-3xl font-bold">
          <Settings className="size-8" />
          Settings
        </h1>
        <Button
          size="small"
          disabled={saving}
          onClick={handleSave}
          className="flex gap-2 items-center"
        >
          <Save size={16} />
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

        <CustomVariables />

        {isElectron() ? (
          <Fragment>
            <Card title="AI Features">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="max-w-md text-sm text-muted-foreground">
                    Configure command-line tools to provide AI assistance. You
                    can use variables like{" "}
                    <code className="text-primary">{"{{prompt}}"}</code>,
                    <code className="text-primary">{"{{selection}}"}</code>, and
                    <code className="text-primary">{"{{context}}"}</code>.
                  </p>
                  <Button
                    size="small"
                    onClick={handleAddAIConfig}
                    className="flex gap-1 items-center"
                  >
                    <Plus size={14} />
                    Add Config
                  </Button>
                </div>
                {aiConfigs.length === 0 ? (
                  <div className="flex flex-col gap-2 items-center p-8 rounded-lg border-dashed opacity-50">
                    <Sparkles size={24} />
                    <p className="text-sm">No AI configurations yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {aiConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="relative p-4 space-y-4 rounded-lg border bg-muted/5 border-border/50 group"
                      >
                        <div className="flex justify-between items-start">
                          <Input
                            value={config.name}
                            title="Configuration Name"
                            container="flex-1 mr-4"
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) =>
                              handleUpdateAIConfig(config.id, {
                                name: e.target.value,
                              })
                            }
                          />
                          <div className="flex gap-2">
                            <Button
                              size="small"
                              theme={
                                config.isDefault ? "primary" : "ghost-primary"
                              }
                              onClick={() => {
                                setAiConfigs(
                                  aiConfigs.map((c) => ({
                                    ...c,
                                    isDefault: c.id === config.id,
                                  })),
                                );
                              }}
                            >
                              {config.isDefault ? "Default" : "Set Default"}
                            </Button>
                            <Button
                              size="small"
                              theme="ghost-danger"
                              onClick={() => handleDeleteAIConfig(config.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                        <Input
                          title="Command Template"
                          value={config.commandTemplate}
                          placeholder='e.g. ollama run llama3 "{{prompt}}"'
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleUpdateAIConfig(config.id, {
                              commandTemplate: e.target.value,
                            })
                          }
                        />
                        <Textarea
                          rows={3}
                          value={config.systemPrompt}
                          title="System Prompt (Context Isolation)"
                          onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>,
                          ) =>
                            handleUpdateAIConfig(config.id, {
                              systemPrompt: e.target.value,
                            })
                          }
                        />

                        <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                          <div className="flex gap-1 items-center">
                            <AlertCircle size={10} />
                            <span>
                              {"{{selection}}"} and {"{{context}}"} are passed
                              via STDIN
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button
                    size="small"
                    disabled={saving}
                    onClick={handleSave}
                    className="flex gap-2 items-center"
                  >
                    <Save size={16} />
                    {saving ? "Saving AI Configs..." : "Save AI Configurations"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Workspace">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-sm">Notes Directory</span>
                  <code className="block p-2 text-[10px] whitespace-pre-wrap break-all rounded bg-muted border border-border/40">
                    {settings.directory ||
                      "No directory selected (Local Storage)"}
                  </code>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">
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
                  <code className="block p-2 text-[10px] whitespace-pre-wrap break-all rounded bg-muted border border-border/40">
                    {settings.templatesDirectory ||
                      "Default (.templates in workspace)"}
                  </code>
                  <p className="text-[10px] text-muted-foreground">
                    Custom folder where your .md templates are stored. Each file
                    can use {"{{VARIABLE}}"} syntax.
                  </p>
                </div>
              </div>
            </Card>
          </Fragment>
        ) : null}
      </div>
    </div>
  );
}
