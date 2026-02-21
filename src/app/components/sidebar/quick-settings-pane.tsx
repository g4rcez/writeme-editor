import { useState, useEffect } from "react";
import { SettingsService, AppSettings } from "@/store/settings";
import { useGlobalStore, globalDispatch } from "@/store/global.store";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { TextTIcon } from "@phosphor-icons/react/dist/csr/TextT";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { clsx } from "clsx";

export const QuickSettingsPane = () => {
  const [globalState] = useGlobalStore();
  const [localSettings, setLocalSettings] = useState<AppSettings>(
    SettingsService.load(),
  );

  const handleToggleTheme = () => {
    const newTheme = globalState.theme === "light" ? "dark" : "light";
    globalDispatch.theme(newTheme);
  };

  const handleToggleAutosave = async () => {
    const updated = await SettingsService.save({
      autosave: !localSettings.autosave,
    });
    setLocalSettings(updated);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    globalDispatch.setEditorFontSize(value);
    setLocalSettings((prev) => ({ ...prev, editorFontSize: value }));
  };

  const handleAutosaveDelayChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = parseInt(e.target.value);
    const updated = await SettingsService.save({ autosaveDelay: value });
    setLocalSettings(updated);
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="px-4 py-2 border-b border-border/20">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Quick Settings
        </span>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto">
        {/* Appearance */}
        <div className="space-y-3">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">
            Appearance
          </label>
          <button
            onClick={handleToggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              {globalState.theme === "light" ? (
                <SunIcon size={16} />
              ) : (
                <MoonIcon size={16} />
              )}
              <span>
                {globalState.theme === "light" ? "Light Mode" : "Dark Mode"}
              </span>
            </div>
            <div
              className={clsx(
                "w-8 h-4 rounded-full relative transition-colors",
                globalState.theme === "dark"
                  ? "bg-primary"
                  : "bg-muted-foreground/30",
              )}
            >
              <div
                className={clsx(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                  globalState.theme === "dark" ? "left-4.5" : "left-0.5",
                )}
              />
            </div>
          </button>
        </div>

        {/* Editor Scaling */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-muted-foreground uppercase">
              Editor Font Size
            </label>
            <span className="text-xs font-mono text-primary">
              {globalState.editorFontSize}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TextTIcon size={14} className="text-muted-foreground" />
            <input
              type="range"
              min="12"
              max="96"
              value={globalState.editorFontSize}
              onChange={handleFontSizeChange}
              className="flex-1 accent-primary h-1 bg-muted/60 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Auto-save */}
        <div className="space-y-3">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">
            Persistence
          </label>
          <button
            onClick={handleToggleAutosave}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <FloppyDiskIcon size={16} />
              <span>Auto-save</span>
            </div>
            <div
              className={clsx(
                "w-8 h-4 rounded-full relative transition-colors",
                localSettings.autosave
                  ? "bg-primary"
                  : "bg-muted-foreground/30",
              )}
            >
              <div
                className={clsx(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                  localSettings.autosave ? "left-4.5" : "left-0.5",
                )}
              />
            </div>
          </button>

          <div className="space-y-2 pl-2 border-l border-border/20 ml-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Save delay (ms)
              </span>
              <span className="text-xs font-mono text-primary">
                {localSettings.autosaveDelay}ms
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon size={12} className="text-muted-foreground" />
              <input
                type="number"
                value={localSettings.autosaveDelay}
                onChange={handleAutosaveDelayChange}
                disabled={!localSettings.autosave}
                className="w-full bg-muted/20 text-xs px-2 py-1 rounded border border-transparent focus:border-primary/30 outline-none disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
