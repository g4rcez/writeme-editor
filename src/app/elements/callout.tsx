import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const inputRegex = /^\|>(info|danger|success|primary|default)? \s?(.*)$/;

export const Callout = Node.create<CalloutOptions>({
  name: "callout",
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  content: "paragraph+",
  group: "block",
  defining: true,
  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="callout"]`, priority: 51 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "callout",
        "data-callout-type": node.attrs.type,
        class: `callout callout-${node.attrs.type}`,
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-c": () => this.editor.commands.toggleWrap(this.name),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const type = match[1] || "info";
          return { type };
        },
      }),
    ];
  },
});
