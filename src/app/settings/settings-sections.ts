import { isElectron } from "@/lib/is-electron";

export type SettingsPlatform = "electron" | "web";

export type SettingsSectionId =
    | "quick"
    | "appearance"
    | "editor"
    | "shortcuts"
    | "trash"
    | "ai"
    | "workspace"
    | "templates"
    | "variables"
    | "migration";

export type SettingsSection = {
    id: SettingsSectionId;
    label: string;
    description: string;
    path: string;
    platform: "all" | SettingsPlatform;
};

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "quick";

export const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "quick",
        label: "Quick Settings",
        description: "Fast access to the settings you change most often.",
        path: "/settings/quick",
        platform: "all",
    },
    {
        id: "ai",
        label: "AI",
        description: "Providers, credentials, models, and prompts.",
        path: "/settings/ai",
        platform: "all",
    },
    {
        id: "appearance",
        label: "Appearance",
        description: "Theme and visual preferences.",
        path: "/settings/appearance",
        platform: "all",
    },
    {
        id: "editor",
        label: "Editor",
        description: "Autosave and editor behavior.",
        path: "/settings/editor",
        platform: "all",
    },
    {
        id: "shortcuts",
        label: "Shortcuts",
        description: "Global shortcuts for quick capture and floating editors.",
        path: "/settings/shortcuts",
        platform: "electron",
    },
    {
        id: "trash",
        label: "Trash",
        description: "Trash retention and auto-purge behavior.",
        path: "/settings/trash",
        platform: "all",
    },
    {
        id: "workspace",
        label: "Workspace",
        description: "Folder-backed notes and template locations.",
        path: "/settings/workspace",
        platform: "electron",
    },
    {
        id: "templates",
        label: "Templates",
        description: "Reusable note templates and source files.",
        path: "/settings/templates",
        platform: "all",
    },
    {
        id: "variables",
        label: "Variables",
        description: "Reusable template variables and expressions.",
        path: "/settings/variables",
        platform: "all",
    },
    {
        id: "migration",
        label: "Migration",
        description: "Import data from the previous web domain.",
        path: "/settings/migration",
        platform: "web",
    },
];

export function getSettingsPlatform(): SettingsPlatform {
    return isElectron() ? "electron" : "web";
}

export function isSettingsSectionAvailable(
    sectionId: SettingsSectionId,
    platform: SettingsPlatform = getSettingsPlatform(),
): boolean {
    const section = SETTINGS_SECTIONS.find((item) => item.id === sectionId);
    return section?.platform === "all" || section?.platform === platform;
}

export function getSettingsSections(platform: SettingsPlatform = getSettingsPlatform()): SettingsSection[] {
    return SETTINGS_SECTIONS.filter((section) => section.platform === "all" || section.platform === platform);
}

export function getSettingsPath(sectionId: SettingsSectionId): string {
    return `/settings/${sectionId}`;
}
