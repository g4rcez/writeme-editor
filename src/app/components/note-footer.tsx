import { editorGlobalRef } from "@/app/editor-global-ref";
import { HARD_LIMIT, WARN_THRESHOLD } from "@/lib/markdown-worker";
import { useEffect, useState } from "react";

type Counts = { chars: number; words: number; lines: number };

const INITIAL: Counts = { chars: 0, words: 0, lines: 1 };

function formatSize(chars: number): string {
	if (chars < 1_000) return `${chars} B`;
	if (chars < 1_000_000) return `${(chars / 1_000).toFixed(1)} KB`;
	return `${(chars / 1_000_000).toFixed(2)} MB`;
}

function usageColor(chars: number): string {
	if (chars >= WARN_THRESHOLD) return "text-danger";
	if (chars >= WARN_THRESHOLD * 0.5) return "text-warn";
	return "text-muted-foreground";
}

const LIMIT_LABEL = `${WARN_THRESHOLD / 1_000_000} MB`;

export function NoteFooter({ noteId }: { noteId: string }) {
	const [counts, setCounts] = useState<Counts>(INITIAL);

	useEffect(() => {
		let cleanup: (() => void) | undefined;

		const subscribe = () => {
			const editor = editorGlobalRef.current;
			if (!editor) return false;

			const compute = () =>
				setCounts({
					chars: editor.storage.characterCount.characters(),
					words: editor.storage.characterCount.words(),
					lines: editor.state.doc.textContent.split("\n").length,
				});

			compute();
			editor.on("update", compute);
			cleanup = () => editor.off("update", compute);
			return true;
		};

		if (!subscribe()) {
			const interval = setInterval(() => {
				if (subscribe()) clearInterval(interval);
			}, 50);
			return () => {
				clearInterval(interval);
				cleanup?.();
			};
		}

		return () => cleanup?.();
	}, [noteId]);

	const pct = Math.min((counts.chars / WARN_THRESHOLD) * 100, 100);
	const color = usageColor(counts.chars);
	const isNearHardLimit = counts.chars >= HARD_LIMIT * 0.8;
	const title = `${formatSize(counts.chars)} of ${LIMIT_LABEL} used (${pct.toFixed(1)}%)${isNearHardLimit ? " — approaching hard limit" : ""}`;

	return (
		<div className="fixed bottom-3 right-4 z-navbar flex items-center justify-end gap-4 rounded-lg border border-border/40 bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-soft print:hidden">
			<span title={title} className={`flex items-center gap-1.5 ${color}`}>
				<span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted">
					<span
						className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
							counts.chars >= WARN_THRESHOLD
								? "bg-danger"
								: counts.chars >= WARN_THRESHOLD * 0.5
									? "bg-warn"
									: "bg-primary/60"
						}`}
						style={{ width: `${pct}%` }}
					/>
				</span>
				<span>{formatSize(counts.chars)}</span>
				<span className="text-muted-foreground/50">/ {LIMIT_LABEL}</span>
			</span>
			<span>{counts.chars} chars</span>
			<span>{counts.words} words</span>
			<span>{counts.lines} lines</span>
		</div>
	);
}
