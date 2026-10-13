import { FEATURES } from "@/lib/build-features";
import { getAppPlatform, type AppPlatform } from "@/lib/platform";

export type SettingsPlatform = AppPlatform;

export type SettingsSectionId =
    | "quick"
    | "appearance"
    | "editor"
    | "vim"
    | "shortcuts"
    | "trash"
    | "ai"
    | "workspace"
    | "templates"
    | "variables"
    | "migration"
    | "backup";

export type SettingsSection = {
    id: SettingsSectionId;
    label: string;
    description: string;
    path: string;
    platform: "all" | SettingsPlatform;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "backup",
        label: "Backup",
        description: "Export and restore your on-device notes and attachments.",
        path: "/settings/backup",
        platform: "mobile",
    },
    {
        id: "quick",
        label: "Quick settings",
        description: "Fast access to the settings you change most often.",
        path: "/settings/quick",
        platform: "all",
    },
    {
        id: "ai",
        label: "AI",
        description: "Connect an AI provider and choose a model.",
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
        id: "vim",
        label: "Vim",
        description: "Shared Vim mode and global TypeScript configuration.",
        path: "/settings/vim",
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
        description: "Choose how long deleted notes stay in Trash.",
        path: "/settings/trash",
        platform: "electron",
    },
    {
        id: "workspace",
        label: "Workspace",
        description: "Choose folders for your notes and templates.",
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

function getSettingsPlatform(): SettingsPlatform {
    return getAppPlatform();
}

export function isSettingsSectionAvailable(
    sectionId: SettingsSectionId,
    platform: SettingsPlatform = getSettingsPlatform(),
): boolean {
    if (sectionId === "ai" && (!FEATURES.ai || platform === "mobile")) return false;
    if (sectionId === "variables" && !FEATURES.templateScripts) return false;
    const section = SETTINGS_SECTIONS.find((item) => item.id === sectionId);
    return section?.platform === "all" || section?.platform === platform;
}

export function getSettingsSections(platform: SettingsPlatform = getSettingsPlatform()): SettingsSection[] {
    return SETTINGS_SECTIONS.filter((section) => isSettingsSectionAvailable(section.id, platform));
}
