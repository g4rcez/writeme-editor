import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import { Node } from "@tiptap/core";
import type { SerializeContext } from "../../serialize/types";

const TaskList = Node.create({
    name: "taskList",
});

const SPACE = "  ";
const EMPTY_TASK_MARKER_PATTERN = /^\s*\[[ xX]\]\s*$/;

const isTaskListItem = (item: Element): boolean => {
    const ownText = Array.from(item.childNodes)
        .filter((child) => !(child instanceof Element) || !["UL", "OL"].includes(child.tagName))
        .map((child) => child.textContent ?? "")
        .join("");
    return (
        Boolean(item.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]')) ||
        EMPTY_TASK_MARKER_PATTERN.test(ownText)
    );
};

export default TaskList.extend({
    addStorage() {
        return {
            markdown: {
                serialize(this: SerializeContext, state: MarkdownSerializerState, node: ProseMirrorNode) {
                    const tightNode =
                        node.attrs.tight !== true
                            ? node.type.create({ ...node.attrs, tight: true }, node.content, node.marks)
                            : node;
                    state.renderList(
                        tightNode,
                        SPACE,
                        () => (this.editor.storage.markdown.options.bulletListMarker || "-") + " ",
                    );
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        Array.from(element.querySelectorAll("ul"))
                            .reverse()
                            .forEach((ul) => {
                                const items = Array.from(ul.querySelectorAll(":scope > li"));
                                if (!items.some(isTaskListItem)) return;
                                const groups: HTMLUListElement[] = [];
                                let previousIsTask: boolean | null = null;
                                for (const item of items) {
                                    const isTask = isTaskListItem(item);
                                    if (isTask !== previousIsTask) {
                                        const group = ul.cloneNode(false) as HTMLUListElement;
                                        if (isTask) group.setAttribute("data-type", "taskList");
                                        else {
                                            group.removeAttribute("data-type");
                                            group.classList.remove("contains-task-list");
                                        }
                                        groups.push(group);
                                        previousIsTask = isTask;
                                    }
                                    item.classList.toggle("task-list-item", isTask);
                                    groups.at(-1)!.append(item);
                                }
                                ul.replaceWith(...groups);
                            });
                    },
                },
            },
        };
    },
});
