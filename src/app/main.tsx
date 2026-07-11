import {
	ComponentsProvider,
	Notifications,
	type Tweaks,
} from "@g4rcez/components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { sortByNewest } from "@/lib/array";
import { isElectron } from "@/lib/is-electron";
import { isAiChatTab } from "@/lib/tab-target";
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
import { nativeTheme } from "./styles/native";
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

const hexToHslaTuple = (hex: string): string | null => {
	const normalized = hex.replace(/^#/, "").slice(0, 6);
	if (!/^[\da-f]{6}$/i.test(normalized)) return null;

	const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
	const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
	const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const lightness = (max + min) / 2;

	let hue = 0;
	let saturation = 0;
	const delta = max - min;
	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));
		if (max === red) hue = ((green - blue) / delta) % 6;
		if (max === green) hue = (blue - red) / delta + 2;
		if (max === blue) hue = (red - green) / delta + 4;
		hue *= 60;
		if (hue < 0) hue += 360;
	}

	return `${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%`;
};

const setSystemAccentColor = (accentColor: string | null): void => {
	if (!accentColor) return;

	const tuple = hexToHslaTuple(accentColor);
	if (!tuple) return;
	document.documentElement.style.setProperty("--native-system-accent", tuple);
};

const applySystemAccentColor = async (): Promise<void> => {
	const accentColor = await window.electronAPI?.app
		?.getSystemAccentColor?.()
		.catch(() => null);
	setSystemAccentColor(accentColor ?? null);
};

const watchSystemAccentColor = (): void => {
	window.electronAPI?.app?.onSystemAccentColorChange?.(setSystemAccentColor);
};

const platformConfiguration = (): void => {
	const isDesktop = isElectron();
	document.documentElement.classList.toggle("platform-electron", isDesktop);
	document.documentElement.classList.toggle("platform-web", !isDesktop);
};

const themeConfiguration = () => {
	const head = globalThis.document.getElementsByTagName("head")[0]!;
	head.append(
		createStyle(
			"default-theme",
			createWritemeThemeCss(":root", lightTheme, "light"),
		),
	);
	head.append(
		createStyle(
			"dark-theme",
			createWritemeThemeCss("html.dark", darkTheme, "dark"),
		),
	);
	head.append(
		createStyle(
			"catppuccin-mocha-theme",
			createWritemeThemeCss(
				"html.catppuccin-mocha",
				catppuccinMochaTheme,
				"dark",
			),
		),
	);
	head.append(
		createStyle(
			"tokyonight-night-theme",
			createWritemeThemeCss(
				"html.tokyonight-night",
				tokyonightNightTheme,
				"dark",
			),
		),
	);
	head.append(
		createStyle(
			"native-theme",
			createWritemeThemeCss("html.native", nativeTheme, "dark"),
		),
	);
	if (globalState().theme !== "light") {
		document.documentElement.classList.add(globalState().theme);
	}
};

export async function main() {
	const rootElement = document.getElementById("root");
	if (!rootElement) {
		throw new Error("Root element not found");
	}
	setupAIAdapters();
	platformConfiguration();
	themeConfiguration();
	void applySystemAccentColor();
	watchSystemAccentColor();
	try {
		try {
			await migrateDexieToSqlite();
		} catch (error) {
			console.error(
				"Dexie to SQLite migration failed; continuing normal startup:",
				error,
			);
		}
		await SettingsService.init();
		const settings = SettingsService.load();
		const launchWorkspace = isElectron()
			? await window.electronAPI.app.getLaunchWorkspace()
			: null;
		const directory = launchWorkspace ?? settings.directory;
		const explorerRoot = launchWorkspace ?? settings.explorerRoot;
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
			(tab) =>
				tab.project === workspaceKey ||
				(shouldIncludeLegacyTabs && !tab.project),
		);
		const { tabs, duplicateTabs } = normalizeWorkspaceTabs(
			workspaceTabs,
			workspaceKey,
		);
		await Promise.all([
			...duplicateTabs.map((tab) => repositories.tabs.delete(tab.id)),
			...tabs
				.filter((tab) => {
					const originalTab = allTabs.find(
						(existing) => existing.id === tab.id,
					);
					return originalTab?.project !== tab.project;
				})
				.map((tab) => repositories.tabs.save(tab)),
		]);
		if (duplicateTabs.length > 0) {
			await repositories.tabs.updateOrder(tabs);
		}
		const terminalSessions = allTerminalSessions.filter(
			(session) => session.project === workspaceKey,
		);
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
		if (tab && isAiChatTab(tab)) {
			globalDispatch.activeTabId(tab.id);
		} else {
			const find = notes.find((x) => x.id === tab?.noteId);
			if (find) {
				const note = await repositories.notes.getOne(find.id);
				globalDispatch.note(note!);
			}
		}
		runPurge().catch(console.error);
		setInterval(() => runPurge().catch(console.error), 60 * 60 * 1000);
	} catch (error) {
		console.error("Failed to load notes:", error);
	}
	createRoot(rootElement).render(
		<StrictMode>
			<ComponentsProvider tweaks={tweaks}>
				<Notifications timeout={10_000}>
					<RouterProvider router={router} />
				</Notifications>
			</ComponentsProvider>
		</StrictMode>,
	);
}
