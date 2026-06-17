import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

const TaskItem = Node.create({
	name: "taskItem",
});

const EMPTY_TASK_MARKER_PATTERN = /^\s*\[([ xX])\]\s*$/;
const TASK_MARKER_PREFIX_PATTERN = /^\s*\[[ xX]\]\s*/;

const removeTaskMarkerText = (item: Element): void => {
	let child = item.firstChild;
	while (child && child.nodeType === 3 && !(child.textContent ?? "").trim()) {
		const next = child.nextSibling;
		child.remove();
		child = next;
	}

	let textNode = child;
	if (textNode && textNode.nodeName.toUpperCase() === "P") {
		textNode = textNode.firstChild;
	}

	if (textNode?.nodeType === 3) {
		textNode.textContent = (textNode.textContent ?? "").replace(
			TASK_MARKER_PREFIX_PATTERN,
			"",
		);
	}
};

export default TaskItem.extend({
	addStorage() {
		return {
			markdown: {
				serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
					const check = node.attrs.checked ? "[x]" : "[ ]";
					state.write(`${check} `);
					state.renderContent(node);
				},
				parse: {
					updateDOM(element: HTMLElement) {
						element.querySelectorAll(".task-list-item").forEach((item) => {
							const input = item.querySelector("input");
							const emptyTaskMarker = input
								? null
								: (item.textContent ?? "").match(EMPTY_TASK_MARKER_PATTERN);

							item.setAttribute("data-type", "taskItem");
							if (input) {
								item.setAttribute("data-checked", String(input.checked));
								input.remove();
							} else if (emptyTaskMarker) {
								item.setAttribute(
									"data-checked",
									String(emptyTaskMarker[1]?.toLowerCase() === "x"),
								);
								removeTaskMarkerText(item);
							}
							while (
								item.firstChild &&
								item.firstChild.nodeType === 3 &&
								!(item.firstChild.textContent ?? "").trim()
							) {
								item.firstChild.remove();
							}
							let textNode = item.firstChild;
							if (textNode && textNode.nodeName.toUpperCase() === "P") {
								textNode = textNode.firstChild;
							}
							if (textNode && textNode.nodeType === 3) {
								textNode.textContent = (textNode.textContent ?? "").replace(
									/^\s+/,
									"",
								);
							}
						});
					},
				},
			},
		};
	},
});
