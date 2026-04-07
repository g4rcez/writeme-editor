import { Node, PasteRule, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import React from "react";

const HEX_SOURCE =
  "#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\\b";
const RGB_SOURCE =
  "rgba?\\(\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*,\\s*\\d{1,3}(?:\\s*,\\s*(?:0|1|0?\\.\\d+))?\\s*\\)";
const HSL_SOURCE =
  "hsla?\\(\\s*\\d{1,3}\\s*,\\s*[\\d.]+%?\\s*,\\s*[\\d.]+%?(?:\\s*,\\s*(?:0|1|0?\\.\\d+))?\\s*\\)";

const COLOR_PATTERN = new RegExp(
  `^(?:${HEX_SOURCE}|${RGB_SOURCE}|${HSL_SOURCE})$`,
  "i",
);

export const isColorValue = (text: string): boolean =>
  COLOR_PATTERN.test(text.trim());

const ColorCodeView = (props: any) => {
  const value: string = props.node.attrs.value || "";
  return (
    <NodeViewWrapper as="span" className="inline">
      <code
        className="inline-code color-code"
        contentEditable={false}
        style={{ "--inline-code-color": value } as React.CSSProperties}
      >
        <span className="color-code-swatch" aria-hidden="true" />
        {value}
      </code>
    </NodeViewWrapper>
  );
};

export const ColorCode = Node.create({
  name: "colorCode",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      value: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "code",
        priority: 60,
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === "string") return false;
          if (element.closest("pre")) return false;
          const text = element.textContent?.trim() ?? "";
          return isColorValue(text) ? { value: text } : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "code",
      mergeAttributes(HTMLAttributes, {
        class: "inline-code color-code",
        "data-type": "colorCode",
        style: `--inline-code-color: ${node.attrs.value}`,
      }),
      node.attrs.value,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColorCodeView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`\`${node.attrs.value}\``);
        },
      },
    };
  },

  addInputRules() {
    return [HEX_SOURCE, RGB_SOURCE, HSL_SOURCE].map((source) => {
      const find = new RegExp(`(?:^|[^\`])\`(${source})\`(?!\`)$`, "i");
      return nodeInputRule({
        find,
        type: this.type,
        getAttributes: (match) => ({ value: (match[1] || match[0]).trim() }),
      });
    });
  },

  addPasteRules() {
    return [HEX_SOURCE, RGB_SOURCE, HSL_SOURCE].map((source) => {
      const find = new RegExp(`(?:^|[^\`])\`(${source})\`(?!\`)`, "gi");
      return new PasteRule({
        find,
        handler: ({ match, chain, range }: any) => {
          if (match?.[1]) {
            chain()
              .insertContentAt(range, {
                type: this.name,
                attrs: { value: match[1].trim() },
              })
              .run();
          }
        },
      });
    });
  },
});
