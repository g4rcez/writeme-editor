import {
	ComponentsProvider,
	Notifications,
	createThemeCss,
	createTokenStyles,
	type TokenRemap,
	type Tweaks,
} from "@g4rcez/components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import {
	getWorkspaceKey,
	globalDispatch,
	globalState,
	normalizeWorkspaceTabs,
	repositories,
} from "../store/global.store";
import { router } from "./router";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";
import { catppuccinMochaTheme } from "./styles/catppuccin-mocha";
import { nativeTheme } from "./styles/native";
import { tokyonightNightTheme } from "./styles/tokyonight-night";
import { createThemeTokens } from "./styles/theme-runtime-tokens";
import { migrateDexieToSqlite } from "../lib/dexie-to-sqlite-migration";
import { SettingsService } from "../store/settings";
import { sortByNewest } from "@/lib/array";
import { isAiChatTab } from "@/lib/tab-target";
import { setupAIAdapters } from "./ai/setup";
import { isElectron } from "@/lib/is-electron";
import { runPurge } from "@/lib/trash/purge";

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

const tokenRemap: TokenRemap = {
	colors: (t) => {
		t.value = t.value.replace("hsla(", "").replace(/\)$/, "");
		return t;
	},
};

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

	return `${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(
		lightness * 100,
	)}%`;
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
	const head = document.getElementsByTagName("head")[0]!;
	head.append(
		createStyle("default-theme", createTokenStyles(lightTheme, tokenRemap)),
	);
	head.append(
		createStyle(
			"default-theme-runtime",
			createThemeCss(createThemeTokens(lightTheme), { selector: ":root" }),
		),
	);
	head.append(
		createStyle(
			"dark-theme",
			createTokenStyles(darkTheme, { ...tokenRemap, name: "dark" }),
		),
	);
	head.append(
		createStyle(
			"dark-theme-runtime",
			createThemeCss(createThemeTokens(darkTheme), { selector: "html.dark" }),
		),
	);
	head.append(
		createStyle(
			"catppuccin-mocha-theme",
			createTokenStyles(catppuccinMochaTheme, {
				...tokenRemap,
				name: "catppuccin-mocha",
			}),
		),
	);
	head.append(
		createStyle(
			"catppuccin-mocha-theme-runtime",
			createThemeCss(createThemeTokens(catppuccinMochaTheme), {
				selector: "html.catppuccin-mocha",
			}),
		),
	);
	head.append(
		createStyle(
			"tokyonight-night-theme",
			createTokenStyles(tokyonightNightTheme, {
				...tokenRemap,
				name: "tokyonight-night",
			}),
		),
	);
	head.append(
		createStyle(
			"tokyonight-night-theme-runtime",
			createThemeCss(createThemeTokens(tokyonightNightTheme), {
				selector: "html.tokyonight-night",
			}),
		),
	);
	head.append(
		createStyle(
			"native-theme",
			createTokenStyles(nativeTheme, {
				...tokenRemap,
				name: "native",
			}),
		),
	);
	head.append(
		createStyle(
			"native-theme-runtime",
			createThemeCss(createThemeTokens(nativeTheme), {
				selector: "html.native",
			}),
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
		await migrateDexieToSqlite();
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
