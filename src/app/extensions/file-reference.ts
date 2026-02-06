import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { fileReferenceSuggestions } from "./file-reference-suggestions";
import { FileReferenceView } from "./file-reference-view";

export const FileReference = Mention.extend({
  name: "fileReference",

  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {},
      renderLabel({ node }) {
        return `${node.attrs.label ?? node.attrs.id}`;
      },
      suggestion: {
        char: "@",
        pluginKey: "fileReferenceSuggestion",
        ...fileReferenceSuggestions,
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileReferenceView);
  },

  renderText({ node }) {
    return `@"${node.attrs.id}"`;
  },
});