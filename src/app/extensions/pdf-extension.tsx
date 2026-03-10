import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";
import { uiDispatch } from "@/store/ui.store";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { FilePdfIcon } from "@phosphor-icons/react/dist/csr/FilePdf";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useState } from "react";

const PdfView = (props: any) => {
  const { node, deleteNode } = props;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const src: string = node.attrs.src ?? "";
  const title: string = node.attrs.title ?? src.split("/").pop() ?? "PDF Document";

  useEffect(() => {
    if (!isElectron() || !src || !src.startsWith("assets/")) {
      setObjectUrl(null);
      return;
    }

    const projectDir = globalState().directory;
    if (!projectDir) return;

    let isMounted = true;
    let currentUrl: string | null = null;

    const loadAsset = async () => {
      try {
        const cleanProjectDir = projectDir.replace(/\/$/, "");
        const cleanSrc = src.replace(/^\//, "");
        const fullPath = `${cleanProjectDir}/${cleanSrc}`;
        
        const result = await window.electronAPI.fs.readBinaryFile(fullPath);
        
        if (!isMounted) return;
        
        if (!result || result.success === false || !result.data) {
          return;
        }

        const blob = new Blob([result.data as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        currentUrl = url;
        setObjectUrl(url);
      } catch (e) {
        console.error("Failed to load local PDF asset", e);
      }
    };

    loadAsset();

    return () => {
      isMounted = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [src]);

  const isLocalAsset = isElectron() && src && src.startsWith("assets/");
  const displaySrc = isLocalAsset ? objectUrl : src;

  const handleOpenPreview = () => {
    if (!displaySrc) return;
    uiDispatch.openMediaPreview([{ src: displaySrc, type: "pdf", title }]);
  };

  return (
    <NodeViewWrapper className="flex relative flex-col items-center my-4 group">
      <div 
        className="flex items-center gap-3 p-4 w-full max-w-lg bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group/card"
        onClick={handleOpenPreview}
      >
        <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
          <FilePdfIcon size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-xs text-muted-foreground truncate">PDF Document</div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <button
            className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPreview();
            }}
            title="Expand"
          >
            <ArrowsOutIcon size={18} />
          </button>
          <button
            title="Delete PDF"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            className="p-1.5 hover:bg-accent rounded-md text-red-400 hover:text-red-500"
          >
            <TrashIcon size={18} />
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
      },
      title: {
        default: "",
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
