import { Button } from "@g4rcez/components";
import { useMemo, useState } from "react";
import { ShortcutSettingsControls } from "@/app/components/settings/settings-controls";
import {
	type Shortcut,
	Type,
	useWritemeShortcuts,
} from "@/app/elements/shortcut-items";
import {
	registerGlobalShortcuts,
	saveSettingsPatch,
} from "@/app/settings/save-settings-section";
import { useSettingsDraft } from "@/app/settings/use-settings-draft";
import { uiDispatch } from "@/store/ui.store";
import { SettingsPageShell } from "./settings-page-shell";

type ReadonlyShortcut = {
	bind: string;
	title: string;
	description: string;
};

const APP_SHORTCUT_REFERENCE: ReadonlyShortcut[] = [
	{
		bind: "mod+1-8",
		title: "Go to tab 1-8",
		description: "Switch directly to one of the first eight open tabs.",
	},
	{
		bind: "mod+9",
		title: "Go to last tab",
		description: "Switch directly to the last open tab.",
	},
	{
		bind: "control+tab",
		title: "Next tab",
		description: "Move to the next open editor tab.",
	},
	{
		bind: "control+shift+tab",
		title: "Previous tab",
		description: "Move to the previous open editor tab.",
	},
	{
		bind: "mod+b",
		title: "Toggle sidebar",
		description: "Show or hide the sidebar panel.",
	},
	{
		bind: "mod+f",
		title: "Find in current note",
		description: "Open find and replace for the active note.",
	},
	{
		bind: "mod+n",
		title: "New note",
		description: "Create a blank note.",
	},
	{
		bind: "mod+shift+n",
		title: "New AI chat",
		description: "Create and open a new workspace AI chat.",
	},
	{
		bind: "mod+p",
		title: "Print current note",
		description: "Open print or export for the active note.",
	},
	{
		bind: "mod+w",
		title: "Close current tab",
		description: "Close the active tab or hide the app.",
	},
	{
		bind: "mod+shift+f",
		title: "Toggle focus mode",
		description: "Hide distractions while writing.",
	},
	{
		bind: "mod+shift+p",
		title: "Commander",
		description: "Open the command palette.",
	},
];

const WRITEME_SHORTCUT_DESCRIPTIONS: Record<string, string> = {
	"AI Assistant": "Open the AI assistant drawer.",
	"Browse files": "Open the workspace file browser.",
	Commander: "Open the command palette.",
	"Dark Mode": "Switch to the dark theme.",
	"Light Mode": "Switch to the light theme.",
	"Open Tabs": "Search and switch between open tabs.",
	"Open...": "Open a file or folder from disk.",
	Reload: "Reload the current app window.",
	Settings: "Open the settings page.",
	"Shortcut/Help menu": "Open the shortcut reference.",
	"Zoom in": "Increase the interface scale.",
	"Zoom normal": "Reset the interface scale.",
	"Zoom out": "Decrease the interface scale.",
};

function getReadonlyShortcuts(shortcuts: Shortcut[]): ReadonlyShortcut[] {
	const seen = new Set<string>();
	const appShortcuts = shortcuts
		.filter((shortcut) => shortcut.type === Type.Shortcut)
		.map(({ bind, description }) => ({
			bind,
			title: description,
			description:
				WRITEME_SHORTCUT_DESCRIPTIONS[description] ??
				`Run the ${description.toLocaleLowerCase()} shortcut.`,
		}));

	return [...APP_SHORTCUT_REFERENCE, ...appShortcuts]
		.filter((shortcut) => {
			const key = `${shortcut.bind}:${shortcut.title}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.toSorted((a, b) =>
			a.bind.toLocaleLowerCase().localeCompare(b.bind.toLocaleLowerCase()),
		);
}

function displayShortcut(bind: string): string {
	const isMac = navigator.platform.startsWith("Mac");
	return bind
		.split("+")
		.map((part) => {
			const key = part.toLocaleLowerCase();
			if (key === "mod") return isMac ? "⌘" : "Ctrl";
			if (key === "control" || key === "ctrl") return "Ctrl";
			if (key === "shift") return isMac ? "⇧" : "Shift";
			if (key === "alt") return isMac ? "⌥" : "Alt";
			if (key === "escape") return isMac ? "Esc" : "Escape";
			if (key === "tab") return "Tab";
			if (part.length === 1) return part.toLocaleUpperCase();
			return part;
		})
		.join(isMac ? "" : "+");
}

function ReadonlyShortcutRow({ shortcut }: { shortcut: ReadonlyShortcut }) {
	return (
		<li className="flex flex-col gap-3 border-b border-card-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
			<div className="max-w-xl">
				<span className="text-sm font-medium text-foreground">
					{shortcut.title}
				</span>
				<p className="text-sm text-muted-foreground">{shortcut.description}</p>
			</div>
			<div className="sm:min-w-48 sm:text-right">
				<kbd className="inline-flex min-w-[120px] justify-center rounded border border-border px-3 py-2 font-mono text-sm tracking-widest text-foreground">
					{displayShortcut(shortcut.bind)}
				</kbd>
			</div>
		</li>
	);
}

function ReadonlyShortcutList({
	shortcuts,
}: {
	shortcuts: ReadonlyShortcut[];
}) {
	return (
		<section className="mt-8">
			<div className="mb-2 max-w-2xl">
				<h2 className="text-base font-semibold text-foreground">
					Available shortcuts
				</h2>
				<p className="mt-1 text-sm leading-6 text-muted-foreground">
					These built-in shortcuts are available in the app and are shown here
					for reference only.
				</p>
			</div>
			<ul>
				{shortcuts.map((shortcut) => (
					<ReadonlyShortcutRow
						key={`${shortcut.bind}-${shortcut.title}`}
						shortcut={shortcut}
					/>
				))}
			</ul>
		</section>
	);
}

export default function SettingsShortcutsPage() {
	const { settings, patchSettings } = useSettingsDraft();
	const writemeShortcuts = useWritemeShortcuts();
	const readonlyShortcuts = useMemo(
		() => getReadonlyShortcuts(writemeShortcuts),
		[writemeShortcuts],
	);
	const [saving, setSaving] = useState(false);

	const onSave = async () => {
		if (!settings) return;
		setSaving(true);
		try {
			await saveSettingsPatch({
				quickNoteShortcut: settings.quickNoteShortcut,
				mathNoteShortcut: settings.mathNoteShortcut,
			});
			const success = await registerGlobalShortcuts(settings);
			if (success) {
				uiDispatch.setAlert({
					open: true,
					message: "Shortcut settings saved.",
					type: "success",
				});
			}
		} finally {
			setSaving(false);
		}
	};

	if (!settings) return <div className="p-8">Loading settings...</div>;

	return (
		<SettingsPageShell
			title="Shortcuts"
			description="Edit the global shortcuts that open quick capture windows."
			actions={
				<Button size="small" disabled={saving} onClick={onSave}>
					{saving ? "Saving..." : "Save Shortcuts"}
				</Button>
			}
		>
			<ShortcutSettingsControls settings={settings} onPatch={patchSettings} />
			<ReadonlyShortcutList shortcuts={readonlyShortcuts} />
		</SettingsPageShell>
	);
}
