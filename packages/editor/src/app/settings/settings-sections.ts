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
    group: "Writing" | "Templates" | "Assistance" | "Workspace" | null;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "quick",
        label: "Quick settings",
        description: "Fast access to the settings you change most often.",
        path: "/settings/quick",
        platform: "all",
        group: null,
    },
    {
        id: "editor",
        label: "Editor",
        description: "Autosave and editor behavior.",
        path: "/settings/editor",
        platform: "all",
        group: "Writing",
    },
    {
        id: "appearance",
        label: "Appearance",
        description: "Theme and visual preferences.",
        path: "/settings/appearance",
        platform: "all",
        group: "Writing",
    },
    {
        id: "vim",
        label: "Vim",
        description: "Shared Vim mode and global TypeScript configuration.",
        path: "/settings/vim",
        platform: "all",
        group: "Writing",
    },
    {
        id: "shortcuts",
        label: "Shortcuts",
        description: "Global shortcuts for quick capture and floating editors.",
        path: "/settings/shortcuts",
        platform: "electron",
        group: "Writing",
    },
    {
        id: "templates",
        label: "Templates",
        description: "Reusable note templates and source files.",
        path: "/settings/templates",
        platform: "all",
        group: "Templates",
    },
    {
        id: "variables",
        label: "Variables",
        description: "Reusable template variables and expressions.",
        path: "/settings/variables",
        platform: "all",
        group: "Templates",
    },
    {
        id: "ai",
        label: "AI",
        description: "Connect an AI provider and choose a model.",
        path: "/settings/ai",
        platform: "all",
        group: "Assistance",
    },
    {
        id: "workspace",
        label: "Workspace",
        description: "Choose folders for your notes and templates.",
        path: "/settings/workspace",
        platform: "electron",
        group: "Workspace",
    },
    {
        id: "backup",
        label: "Backup",
        description: "Export and restore your on-device notes and attachments.",
        path: "/settings/backup",
        platform: "mobile",
        group: "Workspace",
    },
    {
        id: "trash",
        label: "Trash",
        description: "Choose how long deleted notes stay in Trash.",
        path: "/settings/trash",
        platform: "electron",
        group: "Workspace",
    },
    {
        id: "migration",
        label: "Migration",
        description: "Import data from the previous web domain.",
        path: "/settings/migration",
        platform: "web",
        group: "Workspace",
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
