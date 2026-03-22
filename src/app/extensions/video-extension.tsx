import { useLocalAsset } from "@/app/hooks/use-local-asset";
import { uiDispatch } from "@/store/ui.store";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { VideoIcon } from "@phosphor-icons/react/dist/csr/Video";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";

const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
};

const VideoView = (props: any) => {
  const { node, deleteNode } = props;

  const src: string = node.attrs.src ?? "";
  const title: string = node.attrs.title ?? "";

  const { loading, error, displaySrc } = useLocalAsset(src, VIDEO_MIME_MAP);

  const handleOpenPreview = () => {
    if (!displaySrc) return;
    uiDispatch.openMediaPreview([{ src: displaySrc, type: "video", title }]);
  };

  return (
    <NodeViewWrapper className="flex relative flex-col items-center my-4 group">
      <div className="relative w-full max-w-2xl rounded-lg overflow-hidden bg-black aspect-video shadow-md">
        {loading && !error && (
          <div className="flex absolute inset-0 justify-center items-center bg-muted/30">
            <CircleNotchIcon
              size={24}
              className="animate-spin text-muted-foreground"
            />
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
