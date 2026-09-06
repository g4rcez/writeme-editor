import { isElectron } from "@/lib/is-electron";
import { type AppSettings, SettingsService } from "@/store/settings";
import { uiDispatch } from "@/store/ui.store";

export async function saveSettingsPatch(patch: Partial<AppSettings>): Promise<AppSettings> {
    return SettingsService.save(patch);
}

type GlobalShortcutSettings = Pick<AppSettings, "quickNoteShortcut" | "mathNoteShortcut" | "floatingEditorShortcut">;

export async function registerGlobalShortcuts(settings: GlobalShortcutSettings): Promise<boolean> {
    if (!isElectron()) return true;

    const [quickNoteResult, mathNoteResult, floatingEditorResult] = await Promise.all([
        window.electronAPI.app.updateShortcut(settings.quickNoteShortcut),
        window.electronAPI.app.updateMathShortcut(settings.mathNoteShortcut),
        window.electronAPI.app.updateFloatingEditorShortcut(settings.floatingEditorShortcut),
    ]);
    const failed = [quickNoteResult, mathNoteResult, floatingEditorResult].find((result) => !result.success);

    if (!failed) return true;

    uiDispatch.setAlert({
        open: true,
        message: `Settings saved, but shortcut registration failed: ${failed.error ?? "unknown error"}`,
        type: "error",
    });
    return false;
}
