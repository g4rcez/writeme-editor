import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";
import { uiDispatch } from "@/store/ui.store";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { VideoIcon } from "@phosphor-icons/react/dist/csr/Video";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useState } from "react";

const VideoView = (props: any) => {
  const { node, deleteNode } = props;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const src: string = node.attrs.src ?? "";
  const title: string = node.attrs.title ?? "";

  useEffect(() => {
    if (!isElectron() || !src || !src.startsWith("assets/")) {
      setObjectUrl(null);
      setLoading(false);
      return;
    }

    const projectDir = globalState().directory;
    if (!projectDir) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let currentUrl: string | null = null;

    const loadAsset = async () => {
      try {
        setLoading(true);
        const cleanProjectDir = projectDir.replace(/\/$/, "");
        const cleanSrc = src.replace(/^\//, "");
        const fullPath = `${cleanProjectDir}/${cleanSrc}`;
        
        const result = await window.electronAPI.fs.readBinaryFile(fullPath);
        
        if (!isMounted) return;
        
        if (!result || result.success === false || !result.data) {
          setError(true);
          setLoading(false);
          return;
        }

        const ext = src.split(".").pop()?.toLowerCase();
        const mimeType = ext === "mp4" ? "video/mp4" : ext === "webm" ? "video/webm" : ext === "ogg" ? "video/ogg" : "video/mp4";
        
        const blob = new Blob([result.data as any], { type: mimeType });
        const url = URL.createObjectURL(blob);
        currentUrl = url;
        setObjectUrl(url);
        setError(false);
      } catch (e) {
        console.error("Failed to load local video asset", e);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
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
    uiDispatch.openMediaPreview([{ src: displaySrc, type: "video", title }]);
  };

  return (
    <NodeViewWrapper className="flex relative flex-col items-center my-4 group">
      <div className="relative w-full max-w-2xl rounded-lg overflow-hidden bg-black aspect-video shadow-md">
        {loading && !error && (
          <div className="flex absolute inset-0 justify-center items-center bg-muted/30">
            <CircleNotchIcon size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex flex-col gap-2 justify-center items-center p-8 h-full text-muted-foreground">
            <VideoIcon size={32} />
            <span className="text-sm">Failed to load video</span>
          </div>
        )}
        {!error && displaySrc && (
          <video
            src={displaySrc}
            className={`w-full h-full ${loading ? "opacity-0" : "opacity-100"}`}
            onLoadedData={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            controls
          />
        )}

        {!error && !loading && (
          <div className="hidden absolute top-2 right-2 gap-1 p-1 rounded group-hover:flex bg-black/50">
            <button
              className="p-1 text-white rounded hover:bg-white/20"
              onClick={handleOpenPreview}
              title="Expand"
            >
              <ArrowsOutIcon size={14} />
            </button>
            <button
              title="Delete video"
              onClick={() => deleteNode()}
              className="p-1 text-red-400 rounded hover:bg-white/20"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{title}</div>
    </NodeViewWrapper>
  );
};

export const VideoExtension = Node.create({
  name: "video",
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
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[video\]\((https?:\/\/\S+)\)\s$/,
        type: this.type,
        getAttributes: (match) => ({ src: match[1] }),
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize: (state: any, node: any) => {
          state.write(`![video](${node.attrs.src || ""})`);
          state.closeBlock(node);
        },
        parse: {
          setup: (marked: any) => {
            marked.use({
              extensions: [
                {
                  name: "video",
                  level: "inline",
                  start(src: string) {
                    return src.indexOf("![video]");
                  },
                  tokenizer(src: string) {
                    const match = src.match(/^!\[video\]\(([^)]+)\)/);
                    if (match) {
                      return {
                        type: "video",
                        raw: match[0],
                        src: match[1],
                      };
                    }
                    return undefined;
                  },
                  renderer(token: any) {
                    return `<video src="${token.src}"></video>`;
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
