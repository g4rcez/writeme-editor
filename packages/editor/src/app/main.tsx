import { Button, ComponentsProvider, Notifications, type Tweaks } from "@g4rcez/components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { sortByNewest } from "@/lib/array";
import { isElectron } from "@/lib/is-electron";
import { isMobile, supportsAI } from "@/lib/platform";
import { FEATURES } from "@/lib/build-features";
import { initializeMobileRuntime } from "@/lib/mobile-runtime";
import { isAiChatTab, isTerminalTab } from "@/lib/tab-target";
import { runPurge } from "@/lib/trash/purge";
import { migrateDexieToSqlite } from "../lib/dexie-to-sqlite-migration";
import {
    getWorkspaceKey,
    globalDispatch,
    globalState,
    normalizeWorkspaceTabs,
    repositories,
} from "../store/global.store";
import { SettingsService } from "../store/settings";
import { setupAIAdapters } from "./ai/setup";
import { router } from "./router";
import { catppuccinMochaTheme } from "./styles/catppuccin-mocha";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";
import { createNativeThemeCss } from "./styles/native";
import { createWritemeThemeCss } from "./styles/theme-css";
import { tokyonightNightTheme } from "./styles/tokyonight-night";

declare global {
    interface Window {
        EXCALIDRAW_ASSET_PATH: string;
    }
}

window.EXCALIDRAW_ASSET_PATH = "/";

const tweaks: Tweaks = {
    input: { iconFeedback: false },
    table: { sticky: 0, filters: false, sorters: false, operations: false },
};

const createStyle = (id: string, innerText: string) =>
    Object.assign(document.createElement("style"), { id, innerText });

const normalizeSystemAccentColor = (accentColor: string): string | null => {
    const normalized = accentColor.replace(/^#/, "").slice(0, 6);
    return /^[\da-f]{6}$/i.test(normalized) ? `#${normalized}` : null;
};

const setSystemAccentColor = (accentColor: string | null): void => {
    if (!accentColor) return;

    const color = normalizeSystemAccentColor(accentColor);
    if (!color) return;
    document.documentElement.style.setProperty("--native-system-accent", color);
};

const applySystemAccentColor = async (): Promise<void> => {
    const accentColor = await window.electronAPI?.app?.getSystemAccentColor?.().catch(() => null);
    setSystemAccentColor(accentColor ?? null);
};

const watchSystemAccentColor = (): void => {
    window.electronAPI?.app?.onSystemAccentColorChange?.(setSystemAccentColor);
};

const platformConfiguration = (): void => {
    const isDesktop = isElectron();
    document.documentElement.classList.toggle("platform-electron", isDesktop);
    document.documentElement.classList.toggle("platform-web", !isDesktop);
    document.documentElement.classList.toggle("platform-mobile", isMobile());
};

const themeConfiguration = () => {
    const head = globalThis.document.getElementsByTagName("head")[0]!;
    head.append(createStyle("default-theme", createWritemeThemeCss("default", lightTheme, "light")));
    head.append(createStyle("dark-theme", createWritemeThemeCss("dark", darkTheme, "dark")));
    head.append(
        createStyle("catppuccin-mocha-theme", createWritemeThemeCss("catppuccin-mocha", catppuccinMochaTheme, "dark")),
    );
    head.append(
        createStyle("tokyonight-night-theme", createWritemeThemeCss("tokyonight-night", tokyonightNightTheme, "dark")),
    );
    head.append(createStyle("native-theme", createNativeThemeCss()));
    if (globalState().theme !== "light") {
        document.documentElement.classList.add(globalState().theme);
    }
};

function StartupFailureScreen() {
    return (
        <main role="alert" className="flex min-h-screen items-center justify-center p-8 text-foreground">
            <div className="max-w-xl space-y-4">
                <h1 className="text-xl font-semibold">Writeme stopped before loading this workspace</h1>
                <p className="text-sm text-muted-foreground">
                    Storage initialization failed, so Writeme is not showing an empty workspace. Avoid clearing this
                    site&apos;s browser data or uninstalling Writeme. Retry, and contact support if it still fails.
                </p>
                <Button size="small" onClick={() => window.location.reload()}>
                    Retry loading
                </Button>
            </div>
        </main>
    );
}

export async function main() {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
        throw new Error("Root element not found");
    }
    if (supportsAI()) setupAIAdapters();
    platformConfiguration();
    themeConfiguration();
    void initializeMobileRuntime().catch((error: unknown) => {
        console.error("Could not initialize mobile system features:", error);
    });
    void applySystemAccentColor();
    watchSystemAccentColor();

    let initializationFailed = false;
    try {
        await migrateDexieToSqlite();
        await SettingsService.init();
        const settings = SettingsService.load();
        const launchWorkspace = isElectron() ? await window.electronAPI.app.getLaunchWorkspace() : null;
        const directory = isMobile() ? null : launchWorkspace ?? settings.directory;
        const explorerRoot = isMobile() ? null : launchWorkspace ?? settings.explorerRoot;
        if (isElectron()) {
            await window.electronAPI.app.setLaunchWorkspace(directory);
        }
        if (isElectron() && directory) {
            await window.electronAPI.app.chdir(directory);
            await window.electronAPI.fs.startWatcher(directory);
        }
        const notes = await repositories.notes.getAll();
        const allTabs = await repositories.tabs.getAll();
        const allTerminalSessions = await repositories.terminalSessions.getAll();
        const workspaceKey = getWorkspaceKey(directory);
        const shouldIncludeLegacyTabs = launchWorkspace === null;
        const workspaceTabs = allTabs.filter(
            (tab) => (supportsAI() || !isAiChatTab(tab)) && (FEATURES.terminal || !isTerminalTab(tab)) &&
                (tab.project === workspaceKey || (shouldIncludeLegacyTabs && !tab.project)),
        );
        const { tabs, duplicateTabs } = normalizeWorkspaceTabs(workspaceTabs, workspaceKey);
        await Promise.all([
            ...duplicateTabs.map((tab) => repositories.tabs.delete(tab.id)),
            ...tabs
                .filter((tab) => {
                    const originalTab = allTabs.find((existing) => existing.id === tab.id);
                    return originalTab?.project !== tab.project;
                })
                .map((tab) => repositories.tabs.save(tab)),
        ]);
        if (duplicateTabs.length > 0) {
            await repositories.tabs.updateOrder(tabs);
        }
        const terminalSessions = !FEATURES.terminal || isMobile() ? [] : allTerminalSessions.filter((session) => session.project === workspaceKey);
        await globalDispatch.init(
            settings.theme,
            notes,
            tabs,
            settings.editorFontSize,
            settings.sidebarWidth,
            directory,
            explorerRoot,
            terminalSessions,
        );
        const tab = sortByNewest(tabs)[0];
        if (tab && (isAiChatTab(tab) || isTerminalTab(tab))) {
            globalDispatch.activeTabId(tab.id);
        } else {
            const find = notes.find((x) => x.id === tab?.noteId);
            if (find) {
                const note = await repositories.notes.getOne(find.id);
                if (note) globalDispatch.note(note);
            }
        }
        if (isElectron()) {
            runPurge().catch(console.error);
            setInterval(() => runPurge().catch(console.error), 60 * 60 * 1000);
        }
    } catch (error) {
        initializationFailed = true;
        console.error("Failed to load notes:", error);
    }

    createRoot(rootElement).render(
        <StrictMode>
            <ComponentsProvider tweaks={tweaks}>
                <Notifications timeout={10_000}>
                    {initializationFailed ? <StartupFailureScreen /> : <RouterProvider router={router} />}
                </Notifications>
            </ComponentsProvider>
        </StrictMode>,
    );
}
