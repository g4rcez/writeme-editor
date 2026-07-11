import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { FilePdfIcon } from "@phosphor-icons/react/dist/csr/FilePdf";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useLocalAsset } from "@/app/hooks/use-local-asset";
import { formatObsidianLink } from "@/lib/obsidian-links";
import { uiDispatch } from "@/store/ui.store";
const PdfView = (props: any) => {
    const { node, deleteNode } = props;

    const src: string = node.attrs.src ?? "";
    const title: string = node.attrs.title ?? src.split("/").pop() ?? "PDF Document";

    const { displaySrc } = useLocalAsset(src, "application/pdf");

    const handleOpenPreview = () => {
        if (!displaySrc) return;
        uiDispatch.openMediaPreview([{ src: displaySrc, type: "pdf", title }]);
    };

    return (
        <NodeViewWrapper className="flex relative flex-col items-center my-4 group">
            <div className="flex items-center gap-3 p-4 w-full max-w-lg bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow group/card">
                <button
                    type="button"
                    aria-label={`Open PDF preview: ${title}`}
                    className="flex flex-1 items-center gap-3 min-w-0 text-left"
                    onClick={handleOpenPreview}
                >
                    <span className="p-3 rounded-md bg-danger-subtle text-danger">
                        <FilePdfIcon aria-hidden="true" size={32} />
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{title}</span>
                        <span className="block text-xs text-muted-foreground truncate">PDF Document</span>
                    </span>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 transition-opacity">
                    <button
                        type="button"
                        aria-label={`Open PDF preview: ${title}`}
                        className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
                        onClick={handleOpenPreview}
                        title="Expand"
                    >
                        <ArrowsOutIcon aria-hidden="true" size={18} />
                    </button>
                    <button
                        type="button"
                        aria-label={`Delete PDF: ${title}`}
                        title="Delete PDF"
                        onClick={deleteNode}
                        className="p-1.5 hover:bg-accent rounded-md text-danger"
                    >
                        <TrashIcon aria-hidden="true" size={18} />
                    </button>
                </div>
            </div>
        </NodeViewWrapper>
    );
};

export const PdfExtension = Node.create({
    name: "pdf",
    group: "block",
    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element) => element.getAttribute("src") || element.getAttribute("data-src"),
            },
            title: {
                default: "",
                parseHTML: (element) => element.getAttribute("title") || element.getAttribute("data-title") || "",
            },
            obsidianTarget: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-obsidian-target"),
            },
            obsidianAlias: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-obsidian-alias"),
            },
            obsidianSubpath: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-obsidian-subpath"),
            },
            obsidianEmbed: {
                default: false,
                parseHTML: (element) => element.getAttribute("data-obsidian-embed") === "true",
            },
        };
    },

    parseHTML() {
        return [{ tag: "div[data-pdf-block]" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes({ "data-pdf-block": "" }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(PdfView);
    },

    addInputRules() {
        return [
            nodeInputRule({
                find: /!\[pdf\]\(([^)]+)\)\s$/,
                type: this.type,
                getAttributes: (match) => ({ src: match[1] }),
            }),
        ];
    },

    addStorage() {
        return {
            markdown: {
                serialize: (state: any, node: any) => {
                    if (node.attrs.obsidianEmbed && node.attrs.obsidianTarget) {
                        state.write(
                            formatObsidianLink({
                                embed: true,
                                target: node.attrs.obsidianTarget,
                                subpath: node.attrs.obsidianSubpath,
                                alias: node.attrs.obsidianAlias,
                            }),
                        );
                        state.closeBlock(node);
                        return;
                    }
                    state.write(`![pdf](${node.attrs.src || ""})`);
                    state.closeBlock(node);
                },
                parse: {
                    setup: (marked: any) => {
                        marked.use({
                            extensions: [
                                {
                                    name: "pdf",
                                    level: "inline",
                                    start(src: string) {
                                        return src.indexOf("![pdf]");
                                    },
                                    tokenizer(src: string) {
                                        const match = src.match(/^!\[pdf\]\(([^)]+)\)/);
                                        if (match) {
                                            return {
                                                type: "pdf",
                                                raw: match[0],
                                                src: match[1],
                                            };
                                        }
                                        return undefined;
                                    },
                                    renderer(token: any) {
                                        return `<div data-pdf-block data-src="${token.src}"></div>`;
                                    },
                                },
                            ],
                        });
                    },
                },
            },
        } as any;
    },
});
