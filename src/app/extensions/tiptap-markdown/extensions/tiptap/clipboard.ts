import { Extension } from "@tiptap/core";
import { DOMParser, Fragment, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { detectMarkdown } from "@/lib/markdown-paste/detect-markdown";
import { dedent } from "@/lib/markdown-worker/dedent";
import { elementFromString } from "../../util/dom";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/;

type MarkdownClipboardOptions = {
    transformPastedText: boolean;
    transformCopiedText: boolean;
    onBeforePaste: (text: string) => string;
};

export const MarkdownClipboard = Extension.create<MarkdownClipboardOptions>({
    name: "markdownClipboard",
    addOptions() {
        return {
            transformPastedText: false,
            transformCopiedText: false,
            onBeforePaste: (text: string) => text,
        };
    },
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("markdownClipboard"),
                props: {
                    clipboardTextParser: (text, context) => {
                        const dedentedText = dedent(this.options.onBeforePaste(text));
                        const parsed = this.editor.storage.markdown.parser!.parse(dedentedText, { inline: true });
                        return DOMParser.fromSchema(this.editor.schema).parseSlice(elementFromString(parsed), {
                            preserveWhitespace: true,
                            context,
                        });
                    },
                    clipboardTextSerializer: (slice) => {
                        if (!this.options.transformCopiedText) {
                            return "";
                        }
                        return this.editor.storage.markdown.serializer!.serialize(
                            slice.content as unknown as import("@tiptap/pm/model").Node,
                        );
                    },
                    handlePaste: (view, event) => {
                        if (!this.options.transformPastedText) {
                            return false;
                        }
                        if (!event.clipboardData) {
                            return false;
                        }

                        let text = event.clipboardData.getData("text/plain");

                        if (text) {
                            text = this.options.onBeforePaste(text);
                            const dedentedText = dedent(text);

                            const fmMatch = dedentedText.match(FRONTMATTER_RE);
                            if (fmMatch) {
                                const schema = this.editor.schema;
                                const fmType = schema.nodes.frontmatter;
                                if (fmType) {
                                    const yamlContent = fmMatch[1];
                                    const body = dedentedText.slice(fmMatch[0].length);
                                    const fmNode = fmType.create(
                                        { language: "yaml" },
                                        yamlContent ? schema.text(yamlContent) : undefined,
                                    );

                                    const nodes = [fmNode];
                                    if (body.trim()) {
                                        const bodyHtml = this.editor.storage.markdown.parser!.parse(body, {
                                            inline: false,
                                        });
                                        const bodyDoc = DOMParser.fromSchema(schema).parse(
                                            elementFromString(bodyHtml),
                                            { preserveWhitespace: true },
                                        );
                                        bodyDoc.content.forEach((node) => nodes.push(node));
                                    }

                                    const slice = new Slice(Fragment.from(nodes), 0, 0);
                                    view.dispatch(view.state.tr.replaceSelection(slice));
                                    return true;
                                }
                            }

                            const parser = this.editor.storage.markdown.parser!;
                            const parsed = parser.parse(dedentedText, { inline: true });
                            const slice = DOMParser.fromSchema(this.editor.schema).parseSlice(
                                elementFromString(parsed),
                                {
                                    preserveWhitespace: true,
                                },
                            );

                            if (detectMarkdown(dedentedText)) {
                                const $from = view.state.selection.$from;
                                let codeBlockDepth = $from.depth;
                                while (codeBlockDepth > 0 && !$from.node(codeBlockDepth).type.spec.code) {
                                    codeBlockDepth -= 1;
                                }

                                if (codeBlockDepth > 0) {
                                    const codeBlock = $from.node(codeBlockDepth);
                                    const blockStart = $from.start(codeBlockDepth);
                                    const blockEnd = $from.end(codeBlockDepth);
                                    const replacesCodeBlock =
                                        codeBlock.content.size === 0 ||
                                        (view.state.selection.from <= blockStart &&
                                            view.state.selection.to >= blockEnd);

                                    if (replacesCodeBlock) {
                                        const parsedDocument = DOMParser.fromSchema(this.editor.schema).parse(
                                            elementFromString(parser.parse(dedentedText, { inline: false })),
                                            { preserveWhitespace: true },
                                        );
                                        const from = $from.before(codeBlockDepth);
                                        const to = $from.after(codeBlockDepth);
                                        view.dispatch(view.state.tr.replaceWith(from, to, parsedDocument.content));
                                        return true;
                                    }
                                }
                            }

                            view.dispatch(view.state.tr.replaceSelection(slice));
                            return true;
                        }

                        return false;
                    },
                },
            }),
        ];
    },
});
