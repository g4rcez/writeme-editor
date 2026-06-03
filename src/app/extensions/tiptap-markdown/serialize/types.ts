import type { Editor } from "@tiptap/core";
import type { Node, Mark } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

export type { Node, Mark };
export type { MarkdownSerializerState };

export type SerializeContext = {
  editor: Editor;
  options: Record<string, unknown>;
};

export type NodeSerializeFn = (
  this: SerializeContext,
  state: MarkdownSerializerState,
  node: Node,
  parent: Node,
  index: number,
) => void;

export type MarkSerializeFn = (
  this: SerializeContext,
  state: MarkdownSerializerState,
  mark: Mark,
  parent: Node,
  index: number,
) => string;

export type MarkSerializerInfo = {
  expelEnclosingWhitespace?: boolean;
  open:
    | string
    | ((
        state: MarkdownSerializerState,
        mark: Mark,
        parent: Node,
        index: number,
      ) => string);
  close:
    | string
    | ((
        state: MarkdownSerializerState,
        mark: Mark,
        parent: Node,
        index: number,
      ) => string);
};

declare module "prosemirror-markdown" {
  interface MarkdownSerializerState {
    out: string;
    marks: Record<string, MarkSerializerInfo>;
    inlines: Array<{ start: number; end?: number; delimiter: string }>;
    inTable: boolean;
  }
}
