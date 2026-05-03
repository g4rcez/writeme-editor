import { type SingleCommands, Editor, Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    markdownTightLists: {
      toggleTight: (tight?: boolean | null) => ReturnType;
    };
  }
}

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
        (tight: boolean | null = null) =>
        ({
          editor,
          commands,
        }: {
          editor: Editor;
          commands: SingleCommands;
        }) => {
          function toggleTight(name: string) {
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
