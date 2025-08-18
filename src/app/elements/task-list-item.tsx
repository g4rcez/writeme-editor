import type { KeyboardShortcutCommand } from "@tiptap/core";
import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface TaskItemOptions {
  onReadOnlyChecked?: (node: ProseMirrorNode, checked: boolean) => boolean;
  nested: boolean;
  HTMLAttributes: Record<string, any>;
  taskListTypeName: string;
  a11y?: {
    checkboxLabel?: (node: ProseMirrorNode, checked: boolean) => string;
  };
}

export const inputRegex = /^\s*(\[([( |x])?\])\s$/;

const parseChecked = (a: any): boolean => {
  if (typeof a === "object") return !a.checked;
  if (a === undefined) return true;
  if (a === null) return true;
  if (a === "true") return false;
  if (a === "false") return true;
  if (typeof a === "boolean") return !a;
  return true;
};

export const TaskListItem = Node.create<TaskItemOptions>({
  name: "taskItem",
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

  defining: true,

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
        const prop = this.editor.getAttributes("taskItem");
        this.editor
          .chain()
          .focus()
          .updateAttributes("taskItem", { checked: parseChecked(prop) })
          .run();
        return true;
      },
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };
    return {
      ...shortcuts,
      Tab: () => {
        console.log(this.name);
        return this.editor.commands.sinkListItem(this.name);
      },
    };
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
        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
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
              const currentNode = tr.doc.nodeAt(position);

              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked,
              });

              return true;
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

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      listItem.dataset.checked = node.attrs.checked;
      checkbox.checked = node.attrs.checked;

      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

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
    ];
  },
});
