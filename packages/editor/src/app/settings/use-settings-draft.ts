import { useEffect, useState } from "react";
import { type AppSettings, SettingsService } from "@/store/settings";

export function useSettingsDraft() {
    const [settings, setSettings] = useState<AppSettings | null>(null);

    useEffect(() => {
        setSettings(SettingsService.load());
    }, []);

    const patchSettings = (patch: Partial<AppSettings>) => {
        setSettings((current) => (current ? { ...current, ...patch } : current));
    };

    const refreshSettings = () => setSettings(SettingsService.load());

    return { settings, setSettings, patchSettings, refreshSettings };
}
