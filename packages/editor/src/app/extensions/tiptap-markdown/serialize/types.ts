import type { Editor } from "@tiptap/core";
import type { Node, Mark } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

export type SerializeContext = {
    editor: Editor;
    options: Record<string, unknown>;
};

type MarkSerializerInfo = {
    expelEnclosingWhitespace?: boolean;
    open: string | ((state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string);
    close: string | ((state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string);
};

declare module "prosemirror-markdown" {
    interface MarkdownSerializerState {
        out: string;
        marks: Record<string, MarkSerializerInfo>;
        inlines: Array<{ start: number; end?: number; delimiter: string }>;
        inTable: boolean;
    }
}
