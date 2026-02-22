import { Extension } from "@tiptap/core";

export const MarkdownTightLists = Extension.create({
  name: "markdownTightLists",
  addOptions: () => ({
    tight: true,
    tightClass: "tight",
    listTypes: ["bulletList", "orderedList", "taskList"],
  }),
  addGlobalAttributes() {
    return [
      {
        types: this.options.listTypes,
        attributes: {
          tight: {
            default: this.options.tight,
            parseHTML: (element) => {
              const dataTight = element.getAttribute("data-tight");
              if (dataTight === "true") return true;
              if (dataTight === "false") return false;
              // Default to tight for task lists, or if options say so.
              // We ignore presence of <p> tags because markdown-it sometimes adds them for indentation reasons
              // which causes unwanted blank lines in serialization.
              return this.options.tight;
            },
            renderHTML: (attributes) => ({
              class: attributes.tight ? this.options.tightClass : null,
              "data-tight": attributes.tight ? "true" : null,
            }),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      toggleTight:
        (tight = null) =>
        ({ editor, commands }) => {
          function toggleTight(name) {
            if (!editor.isActive(name)) {
              return false;
            }
            const attrs = editor.getAttributes(name);
            return commands.updateAttributes(name, {
              tight: tight ?? !attrs?.tight,
            });
          }
          return this.options.listTypes.some((name) => toggleTight(name));
        },
    };
  },
});
