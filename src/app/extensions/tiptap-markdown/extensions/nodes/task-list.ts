import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { SerializeContext } from "../../serialize/types";

const TaskList = Node.create({
	name: "taskList",
});

const SPACE = "  ";
const EMPTY_TASK_MARKER_PATTERN = /^\s*\[[ xX]\]\s*$/;

const isTaskListItem = (item: Element): boolean => {
	return (
		Boolean(item.querySelector('input[type="checkbox"]')) ||
		EMPTY_TASK_MARKER_PATTERN.test(item.textContent ?? "")
	);
};

export default TaskList.extend({
	addStorage() {
		return {
			markdown: {
				serialize(
					this: SerializeContext,
					state: MarkdownSerializerState,
					node: ProseMirrorNode,
				) {
					const tightNode =
						node.attrs.tight !== true
							? node.type.create(
									{ ...node.attrs, tight: true },
									node.content,
									node.marks,
								)
							: node;
					state.renderList(
						tightNode,
						SPACE,
						() =>
							(this.editor.storage.markdown.options.bulletListMarker || "-") +
							" ",
					);
				},
				parse: {
					updateDOM(element: HTMLElement) {
						element.querySelectorAll("ul").forEach((ul) => {
							const items = Array.from(ul.querySelectorAll(":scope > li"));
							if (items.some(isTaskListItem)) {
								ul.setAttribute("data-type", "taskList");
								items.forEach((li) => li.classList.add("task-list-item"));
							}
						});
					},
				},
			},
		};
	},
});
