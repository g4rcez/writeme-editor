import type { KeyboardShortcutCommand } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import { Dates } from "@/lib/dates";

export type TaskItemOptions = {
    onReadOnlyChecked?: (node: ProseMirrorNode, checked: boolean) => boolean;
    nested: boolean;
    HTMLAttributes: Record<string, any>;
    taskListTypeName: string;
    a11y?: {
        checkboxLabel?: (node: ProseMirrorNode, checked: boolean) => string;
    };
};

export const inputRegex = /^\s*([-*+])?\s*(\[([( |x])?\])\s$/;

const parseChecked = (a: any): boolean => {
    if (typeof a === "object") return !a.checked;
    if (a === undefined) return true;
    if (a === null) return true;
    if (a === "true") return false;
    if (a === "false") return true;
    if (typeof a === "boolean") return !a;
    return true;
};

const taskFinishedAtPattern = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export const formatTaskFinishedAt = (date = new Date()): string => `${Dates.yearMonthDay(date)} ${Dates.time(date)}`;

const getTaskParagraph = (taskNode: ProseMirrorNode, taskPos: number) => {
    const paragraph = taskNode.firstChild;
    if (!paragraph?.isTextblock) return null;
    const paragraphPos = taskPos + 1;
    return {
        node: paragraph,
        contentStart: paragraphPos + 1,
        contentEnd: paragraphPos + paragraph.nodeSize - 1,
    };
};

const getFinishedAtRange = (doc: ProseMirrorNode, taskPos: number) => {
    const taskNode = doc.nodeAt(taskPos);
    if (!taskNode || taskNode.type.name !== "taskItem") return null;

    const paragraph = getTaskParagraph(taskNode, taskPos);
    if (!paragraph) return null;

    let rangeFrom: number | null = null;
    let rangeTo: number | null = null;
    paragraph.node.descendants((node, pos) => {
        if (!node.isText || !node.text) return;

        const to = paragraph.contentStart + pos + node.text.length;
        if (to !== paragraph.contentEnd) return;

        const match = node.text.match(taskFinishedAtPattern);
        if (!match || match.index === undefined) return;

        const hasSubscriptMark = node.marks.some((mark) => mark.type.name === "subscript");
        if (!hasSubscriptMark) return;

        rangeFrom = paragraph.contentStart + pos + match.index;
        rangeTo = to;
    });

    if (rangeFrom === null || rangeTo === null) return null;

    if (rangeFrom > paragraph.contentStart) {
        const previousChar = doc.textBetween(rangeFrom - 1, rangeFrom, "", "");
        if (previousChar === " ") {
            return { from: rangeFrom - 1, to: rangeTo };
        }
    }

    return { from: rangeFrom, to: rangeTo };
};

const getTaskItemPositionFromSelection = (tr: Transaction): number | null => {
    const { $from } = tr.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === "taskItem") {
            return $from.before(depth);
        }
    }
    return null;
};

type SetTaskItemCheckedOptions = {
    taskPos: number;
    checked: boolean;
    finishedAt?: Date;
};

export function setTaskItemChecked(
    tr: Transaction,
    { taskPos, checked, finishedAt = new Date() }: SetTaskItemCheckedOptions,
): boolean {
    const taskNode = tr.doc.nodeAt(taskPos);
    if (!taskNode || taskNode.type.name !== "taskItem") return false;

    tr.setNodeMarkup(taskPos, undefined, {
        ...taskNode.attrs,
        checked,
    });

    const existingFinishedAt = getFinishedAtRange(tr.doc, taskPos);
    if (existingFinishedAt) {
        tr.delete(existingFinishedAt.from, existingFinishedAt.to);
    }

    if (!checked) return true;

    const updatedTaskNode = tr.doc.nodeAt(taskPos);
    if (!updatedTaskNode) return true;

    const paragraph = getTaskParagraph(updatedTaskNode, taskPos);
    if (!paragraph) return true;

    const timestamp = formatTaskFinishedAt(finishedAt);
    const paragraphText = paragraph.node.textContent;
    const prefix = paragraphText.length > 0 && !paragraphText.match(/\s$/) ? " " : "";
    const subscriptMark = tr.doc.type.schema.marks.subscript;
    let insertAt = paragraph.contentEnd;

    if (prefix) {
        tr.insertText(prefix, insertAt);
        insertAt += prefix.length;
    }

    if (!subscriptMark) {
        tr.insertText(`~${timestamp}~`, insertAt);
        return true;
    }

    tr.insertText(timestamp, insertAt);
    tr.addMark(insertAt, insertAt + timestamp.length, subscriptMark.create());
    return true;
}

export const TaskListItem = Node.create<TaskItemOptions>({
    name: "taskItem",
    defining: true,
    addOptions() {
        return {
            nested: true,
            a11y: undefined,
            HTMLAttributes: {},
            taskListTypeName: "taskList",
        };
    },
    content() {
        return this.options.nested ? "paragraph block*" : "paragraph+";
    },
    addAttributes() {
        return {
            checked: {
                default: false,
                keepOnSplit: false,
                parseHTML: (element) => {
                    const dataChecked = element.getAttribute("data-checked");
                    return dataChecked === "" || dataChecked === "true";
                },
                renderHTML: (attributes) => ({
                    "data-checked": attributes.checked,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: `li[data-type="${this.name}"]`,
                priority: 51,
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            "li",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                "data-type": this.name,
            }),
            [
                "label",
                [
                    "input",
                    {
                        type: "checkbox",
                        checked: node.attrs.checked ? "checked" : null,
                    },
                ],
                ["span"],
            ],
            ["div", 0],
        ];
    },

    addKeyboardShortcuts() {
        const shortcuts: {
            [key: string]: KeyboardShortcutCommand;
        } = {
            Enter: () => this.editor.commands.splitListItem(this.name),
            "Mod-Enter": () => {
                const checked = parseChecked(this.editor.getAttributes("taskItem"));
                this.editor
                    .chain()
                    .focus()
                    .command(({ tr }) => {
                        const position = getTaskItemPositionFromSelection(tr);
                        return position === null ? false : setTaskItemChecked(tr, { taskPos: position, checked });
                    })
                    .run();
                return true;
            },
            "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
            Tab: () => {
                if (this.name === "taskItem") return this.editor.chain().sinkListItem(this.name).run();
                return false;
            },
        };
        return shortcuts;
    },

    addNodeView() {
        return ({ node, HTMLAttributes, getPos, editor }) => {
            const listItem = document.createElement("li");
            const checkboxWrapper = document.createElement("label");
            const checkboxStyler = document.createElement("span");
            const checkbox = document.createElement("input");
            const content = document.createElement("div");
            const updateA11Y = (currentNode: ProseMirrorNode) => {
                checkbox.ariaLabel =
                    this.options.a11y?.checkboxLabel?.(currentNode, checkbox.checked) ||
                    `Task item checkbox for ${currentNode.textContent || "empty task item"}`;
            };
            updateA11Y(node);
            checkboxWrapper.contentEditable = "false";
            checkbox.type = "checkbox";
            checkbox.addEventListener("mousedown", (event) => event.preventDefault());
            checkbox.addEventListener("change", (event) => {
                if (!editor.isEditable && !this.options.onReadOnlyChecked) {
                    checkbox.checked = !checkbox.checked;
                    return;
                }
                const { checked } = event.target as any;
                if (editor.isEditable && typeof getPos === "function") {
                    editor
                        .chain()
                        .focus(undefined, { scrollIntoView: false })
                        .command(({ tr }) => {
                            const position = getPos();

                            if (typeof position !== "number") {
                                return false;
                            }
                            return setTaskItemChecked(tr, { taskPos: position, checked });
                        })
                        .run();
                }
                if (!editor.isEditable && this.options.onReadOnlyChecked) {
                    // Reset state if onReadOnlyChecked returns false
                    if (!this.options.onReadOnlyChecked(node, checked)) {
                        checkbox.checked = !checkbox.checked;
                    }
                }
            });

            for (const [key, value] of Object.entries(this.options.HTMLAttributes)) {
                listItem.setAttribute(key, value);
            }

            listItem.dataset.checked = node.attrs.checked;
            checkbox.checked = node.attrs.checked;

            checkboxWrapper.append(checkbox, checkboxStyler);
            listItem.append(checkboxWrapper, content);

            for (const [key, value] of Object.entries(HTMLAttributes)) {
                listItem.setAttribute(key, value);
            }

            return {
                dom: listItem,
                contentDOM: content,
                update: (updatedNode) => {
                    if (updatedNode.type !== this.type) {
                        return false;
                    }

                    listItem.dataset.checked = updatedNode.attrs.checked;
                    checkbox.checked = updatedNode.attrs.checked;
                    updateA11Y(updatedNode);

                    return true;
                },
            };
        };
    },

    addInputRules() {
        return [
            wrappingInputRule({
                find: inputRegex,
                type: this.type,
                getAttributes: (match) => ({
                    checked: match[match.length - 1] === "x",
                }),
            }),
            wrappingInputRule({
                find: /^\s*([-*+])?\s*(\[([( |x])?\])\s/,
                type: this.type,
                getAttributes: (match) => ({
                    checked: match[match.length - 1] === "x",
                }),
            }),
        ];
    },
});
