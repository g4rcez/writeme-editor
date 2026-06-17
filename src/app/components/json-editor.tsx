import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { tokyoNightStorm } from "@uiw/codemirror-theme-tokyo-night-storm";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { Button } from "@g4rcez/components";
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly";
import { useGlobalStore } from "@/store/global.store";
import { controller } from "@/app/controller";

const jsonLightTheme = createTheme({
	theme: "light",
	settings: {
		background: "var(--json-bg)",
		foreground: "var(--json-string)",
		caret: "var(--json-caret)",
		selection: "var(--json-hover)",
		selectionMatch: "var(--json-hover)",
		lineHighlight: "var(--json-hover)",
		gutterBackground: "var(--json-bg)",
		gutterForeground: "var(--json-null)",
	},
	styles: [
		{ tag: t.propertyName, color: "var(--json-key)" },
		{ tag: t.string, color: "var(--json-string)" },
		{ tag: t.number, color: "var(--json-number)" },
		{ tag: [t.bool, t.keyword], color: "var(--json-boolean)" },
		{ tag: t.null, color: "var(--json-null)" },
		{ tag: [t.punctuation, t.bracket], color: "var(--json-separator)" },
	],
});

type Props = {
	value: string;
	onChange: (v: string) => void;
	className?: string;
};

export const JsonEditor = ({ value, onChange, className }: Props) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const themeCompartment = useRef(new Compartment());
	const [formatError, setFormatError] = useState<string | null>(null);

	const [state] = useGlobalStore();
	const isDark = state.theme !== "light";

	useEffect(() => {
		if (!containerRef.current) return;

		const view = new EditorView({
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					json(),
					themeCompartment.current.of(
						isDark ? tokyoNightStorm : jsonLightTheme,
					),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							setFormatError(null);
							onChange(update.state.doc.toString());
						}
					}),
					EditorView.theme({
						"&": {
							height: "100%",
							fontSize: "0.875rem",
							overflow: "hidden",
						},
						".cm-scroller": {
							overflow: "auto",
							fontFamily: "JetBrains Mono Variable, monospace",
						},
					}),
				],
			}),
			parent: containerRef.current,
		});

		viewRef.current = view;

		(async () => {
			try {
				const text = await controller.clipboard();
				const parsed = JSON.parse(text);
				const formatted = JSON.stringify(parsed, null, 2);
				if (view.state.doc.length === 0) {
					view.dispatch({
						changes: { from: 0, to: view.state.doc.length, insert: formatted },
					});
					onChange(formatted);
				}
			} catch {
				// Clipboard JSON is optional seed data; invalid clipboard content leaves the editor unchanged.
			}
		})();

		return () => {
			view.destroy();
			viewRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!viewRef.current) return;
		viewRef.current.dispatch({
			effects: themeCompartment.current.reconfigure(
				isDark ? tokyoNightStorm : jsonLightTheme,
			),
		});
	}, [isDark]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		const current = view.state.doc.toString();
		if (current === value) return;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: value },
		});
	}, [value]);

	const handleFormat = useCallback(() => {
		const view = viewRef.current;
		if (!view) return;
		try {
			const parsed = JSON.parse(view.state.doc.toString());
			const formatted = JSON.stringify(parsed, null, 2);
			const changes = { from: 0, to: view.state.doc.length, insert: formatted };
			view.dispatch({ changes });
			setFormatError(null);
			onChange(formatted);
		} catch (error) {
			setFormatError(error instanceof Error ? error.message : "Invalid JSON");
		}
	}, [onChange]);

	return (
		<div className={className} style={{ position: "relative" }}>
			<div ref={containerRef} className="h-full w-full" />
			<div className="absolute top-2 right-2 z-10">
				<Button
					size="small"
					theme="ghost-primary"
					onClick={handleFormat}
					title="Format JSON"
					aria-label="Format JSON"
				>
					<BracketsCurlyIcon size={14} />
				</Button>
			</div>
			{formatError ? (
				<p
					role="alert"
					className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded border border-danger/40 bg-danger-subtle px-2 py-1 text-xs text-danger"
				>
					Invalid JSON: {formatError}
				</p>
			) : null}
		</div>
	);
};
