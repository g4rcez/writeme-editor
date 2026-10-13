import { useSyncExternalStore } from "react";
import { SettingsService } from "@/store/settings";

function subscribe(listener: () => void): () => void {
    window.addEventListener("writeme-settings-changed", listener);
    return () => window.removeEventListener("writeme-settings-changed", listener);
}

export function useVimSettings(): { readonly enabled: boolean; readonly source: string } {
    const enabled = useSyncExternalStore(subscribe, () => SettingsService.load().vimMode);
    const source = useSyncExternalStore(subscribe, () => SettingsService.load().vimConfig ?? "");
    return { enabled, source };
}
