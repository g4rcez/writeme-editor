import { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createExtensions } from "../extensions";
import { setTaskItemChecked } from "./task-list-item";

function createEditor(content: string): Editor {
	return new Editor({
		content,
		extensions: createExtensions(() => "github-dark"),
	});
}

function findTaskItemPos(doc: ProseMirrorNode): number {
	let taskPos: number | null = null;
	doc.descendants((node, pos) => {
		if (node.type.name === "taskItem") {
			taskPos = pos;
			return false;
		}
		return true;
	});

	if (taskPos === null) {
		throw new Error("Expected a taskItem in the test document");
	}

	return taskPos;
}

describe("TaskListItem", () => {
	let editor: Editor | null = null;

	beforeEach(() => {
		document.elementFromPoint = () => document.body;
	});

	afterEach(() => {
		editor?.destroy();
		editor = null;
	});

	it("parses single tilde as subscript without stealing strikethrough", () => {
		editor = createEditor("Water H~2~O and ~~done~~");

		expect(editor.getHTML()).toContain("H<sub>2</sub>O");
		expect(editor.getMarkdown()).toContain("H~2~O");
		expect(editor.getMarkdown()).toContain("~~done~~");
	});

	it("parses an empty task marker as an unchecked task item", () => {
		editor = createEditor("# Tasks\n\n- [ ]\n\n## Later\n\n- [x]");

		const taskItems: Array<{ checked: boolean; text: string }> = [];
		editor.state.doc.descendants((node) => {
			if (node.type.name === "taskItem") {
				taskItems.push({
					checked: Boolean(node.attrs.checked),
					text: node.textContent,
				});
			}
		});

		expect(taskItems).toStrictEqual([
			{ checked: false, text: "" },
			{ checked: true, text: "" },
		]);
		expect(editor.getMarkdown()).toContain("- [ ]");
		expect(editor.getMarkdown()).toContain("- [x]");
		expect(editor.getHTML()).toContain('type="checkbox"');
	});

	it("adds a subscript finished timestamp when a task is completed", () => {
		editor = createEditor("- [ ] Write tests");
		const taskPos = findTaskItemPos(editor.state.doc);

		editor
			.chain()
			.command(({ tr }) =>
				setTaskItemChecked(tr, {
					taskPos,
					checked: true,
					finishedAt: new Date(2026, 5, 17, 14, 22),
				}),
			)
			.run();

		expect(editor.getMarkdown()).toContain(
			"- [x] Write tests ~2026-06-17 14:22~",
		);
		expect(editor.getHTML()).toContain("<sub>2026-06-17 14:22</sub>");
	});

	it("replaces an existing finished timestamp instead of duplicating it", () => {
		editor = createEditor("- [x] Write tests ~2026-06-17 14:22~");
		const taskPos = findTaskItemPos(editor.state.doc);

		editor
			.chain()
			.command(({ tr }) =>
				setTaskItemChecked(tr, {
					taskPos,
					checked: true,
					finishedAt: new Date(2026, 5, 18, 9, 5),
				}),
			)
			.run();

		expect(editor.getMarkdown()).toContain(
			"- [x] Write tests ~2026-06-18 09:05~",
		);
		expect(editor.getMarkdown()).not.toContain("2026-06-17 14:22");
	});

	it("removes the finished timestamp when a task is unchecked", () => {
		editor = createEditor("- [x] Write tests ~2026-06-17 14:22~");
		const taskPos = findTaskItemPos(editor.state.doc);

		editor
			.chain()
			.command(({ tr }) =>
				setTaskItemChecked(tr, {
					taskPos,
					checked: false,
				}),
			)
			.run();

		expect(editor.getMarkdown()).toContain("- [ ] Write tests");
		expect(editor.getMarkdown()).not.toContain("2026-06-17 14:22");
	});
});
