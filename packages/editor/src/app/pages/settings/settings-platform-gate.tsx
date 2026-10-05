import type { ReactNode } from "react";
import { isSettingsSectionAvailable, type SettingsSectionId } from "@/app/settings/settings-sections";
import SettingsNotFoundPage from "./settings-not-found.page";

type SettingsPlatformGateProps = {
    sectionId: SettingsSectionId;
    children: ReactNode;
};

export function SettingsPlatformGate({ sectionId, children }: SettingsPlatformGateProps) {
    if (!isSettingsSectionAvailable(sectionId)) {
        return <SettingsNotFoundPage />;
    }

    return <>{children}</>;
}
