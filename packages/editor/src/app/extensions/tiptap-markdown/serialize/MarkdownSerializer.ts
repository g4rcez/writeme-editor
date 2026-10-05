import type { Editor, AnyExtension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import HTMLMark from "../extensions/marks/html";
import HardBreak from "../extensions/nodes/hard-break";
import HTMLNode from "../extensions/nodes/html";
import { getMarkdownSpec } from "../util/extensions";
import { MarkdownSerializerState } from "./state";

export class MarkdownSerializer {
    editor!: Editor;

    public constructor(editor: Editor) {
        this.editor = editor;
    }

    serialize(content: Node): string {
        if (!this.editor.schema || !this.editor.extensionManager) return "";

        const state = new MarkdownSerializerState(this.nodes, this.marks, {
            ...this.editor.storage.markdown.options,
            hardBreakNodeName: HardBreak.name,
        });
        state.renderContent(content);
        return state.out;
    }

    get nodes() {
        if (!this.editor.schema || !this.editor.extensionManager) return {};

        return {
            ...Object.fromEntries(
                Object.keys(this.editor.schema.nodes).map((name) => [name, this.serializeNode(HTMLNode)]),
            ),
            ...Object.fromEntries(
                this.editor.extensionManager.extensions
                    .filter((extension: AnyExtension) => extension.type === "node" && this.serializeNode(extension))
                    .map((extension: AnyExtension) => [extension.name, this.serializeNode(extension)]) ?? [],
            ),
        };
    }

    get marks() {
        if (!this.editor.schema || !this.editor.extensionManager) return {};

        return {
            ...Object.fromEntries(
                Object.keys(this.editor.schema.marks).map((name) => [name, this.serializeMark(HTMLMark)]),
            ),
            ...Object.fromEntries(
                this.editor.extensionManager.extensions
                    .filter((extension: AnyExtension) => extension.type === "mark" && this.serializeMark(extension))
                    .map((extension: AnyExtension) => [extension.name, this.serializeMark(extension)]) ?? [],
            ),
        };
    }

    serializeNode(node: AnyExtension) {
        return getMarkdownSpec(node)?.serialize?.bind({
            editor: this.editor,
            options: node.options,
        });
    }

    serializeMark(mark: AnyExtension) {
        const serialize = getMarkdownSpec(mark)?.serialize;
        return serialize
            ? {
                  ...serialize,
                  open:
                      typeof serialize.open === "function"
                          ? serialize.open.bind({
                                editor: this.editor,
                                options: mark.options,
                            })
                          : serialize.open,
                  close:
                      typeof serialize.close === "function"
                          ? serialize.close.bind({
                                editor: this.editor,
                                options: mark.options,
                            })
                          : serialize.close,
              }
            : null;
    }
}
