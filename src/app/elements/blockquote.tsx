/** @jsxImportSource @tiptap/core */
import { css } from "@g4rcez/components";
import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

export interface BlockquoteOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockQuote: {
      /**
       * Set a blockquote node
       */
      setBlockquote: () => ReturnType;
      /**
       * Toggle a blockquote node
       */
      toggleBlockquote: () => ReturnType;
      /**
       * Unset a blockquote node
       */
      unsetBlockquote: () => ReturnType;
    };
  }
}

export const inputRegex = /^\s*>(?<theme>info|warning|warn|alert|danger)?\s$/;

export const Blockquote = Node.create<BlockquoteOptions>({
  name: "blockquote",
  content: "block+",
  group: "block",
  defining: true,
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [{ tag: "blockquote" }];
  },
  addAttributes() {
    return { "data-theme": "ok" };
  },
  renderHTML(props) {
    const theme = props?.HTMLAttributes["data-theme"];
    const attrs = mergeAttributes(
      this.options.HTMLAttributes,
      props.HTMLAttributes,
    );
    return (
      <blockquote {...attrs} data-theme={theme} data-callout={!!theme}>
        <slot />
      </blockquote>
    );
  },

  addCommands() {
    return {
      setBlockquote:
        () =>
          ({ commands }) => {
            return commands.wrapIn(this.name);
          },
      toggleBlockquote:
        () =>
          ({ commands }) => {
            return commands.toggleWrap(this.name);
          },
      unsetBlockquote:
        () =>
          ({ commands }) => {
            return commands.lift(this.name);
          },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-b": () => this.editor.commands.toggleBlockquote(),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        keepAttributes: true,
        getAttributes: (m) => ({ "data-theme": m.groups?.theme }),
      }),
    ];
  },
});
