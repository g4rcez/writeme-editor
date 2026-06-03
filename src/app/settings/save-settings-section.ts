import { isElectron } from "@/lib/is-electron";
import { type AppSettings, SettingsService } from "@/store/settings";
import { uiDispatch } from "@/store/ui.store";

export async function saveSettingsPatch(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  return SettingsService.save(patch);
}

export async function registerGlobalShortcuts(
  settings: Pick<AppSettings, "quickNoteShortcut" | "mathNoteShortcut">,
): Promise<boolean> {
  if (!isElectron()) return true;

  const [quickNoteResult, mathNoteResult] = await Promise.all([
    window.electronAPI.app.updateShortcut(settings.quickNoteShortcut),
    window.electronAPI.app.updateMathShortcut(settings.mathNoteShortcut),
  ]);
  const failed = [quickNoteResult, mathNoteResult].find(
    (result) => !result.success,
  );

  if (!failed) return true;

  uiDispatch.setAlert({
    open: true,
    message: `Settings saved, but shortcut registration failed: ${failed.error ?? "unknown error"}`,
    type: "error",
  });
  return false;
}
