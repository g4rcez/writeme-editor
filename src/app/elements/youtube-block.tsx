import { Node, nodeInputRule, PasteRule } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
  NodeViewWrapper,
} from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { identifyDomain } from "../../lib/url-utils";

const YoutubeView = (props: ReactNodeViewProps) => {
  const { videoId } = props.node.attrs;

  if (!videoId) {
    return (
      <NodeViewWrapper className="p-4 border border-dashed rounded-md bg-muted/20 text-muted-foreground border-muted">
        Invalid YouTube URL
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-4 overflow-hidden rounded-lg shadow-sm group">
      <div className="relative w-full aspect-video bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </NodeViewWrapper>
  );
};

export const YoutubeBlock = Node.create({
  name: "youtubeBlock",
  group: "block",
  atom: true,
  draggable: true,
  priority: 1000, // High priority to run before other handlers

  addAttributes() {
    return {
      url: {
        default: null,
      },
      videoId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-youtube-video]",
        getAttributes: (element: string | HTMLElement) => {
          if (typeof element === "string") return {};
          const url = element.getAttribute("data-url");
          const info = identifyDomain(url || "");
          return {
            url,
            videoId: info?.id,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-youtube-video": "", "data-url": HTMLAttributes.url },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("youtube-paste-handler"),
        props: {
          handlePaste: (view, event) => {
            if (!view.editable) return false;

            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;

            const info = identifyDomain(text);
            if (info && info.domain === "youtube") {
              const { state, dispatch } = view;
              const node = state.schema.nodes.youtubeBlock.create({
                url: info.url,
                videoId: info.id,
              });
              const tr = state.tr.replaceSelectionWith(node);
              dispatch(tr);
              return true; // We handled it!
            }
            return false;
          },
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/g,
        handler: ({ match, chain, range }) => {
          const info = identifyDomain(match[0]);
          if (info && info.domain === "youtube") {
            chain()
              .insertContentAt(range, {
                type: this.name,
                attrs: { url: info.url, videoId: info.id },
              })
              .run();
          }
        },
      }),
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[youtube\]\((https?:\/\/\S+)\)\s$/,
        type: this.type,
        getAttributes: (match) => {
          const info = identifyDomain(match[1]);
          return {
            url: match[1],
            videoId: info?.id,
          };
        },
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize: (state: any, node: any) => {
          state.write(`![youtube](${node.attrs.url})`);
          state.closeBlock(node);
        },
        parse: {
          setup: (marked: any) => {
            marked.use({
              extensions: [
                {
                  name: "youtube_video",
                  level: "inline",
                  start(src: string) {
                    return src.indexOf("![youtube]");
                  },
                  tokenizer(src: string) {
                    const match = src.match(
                      /^!\[youtube\]\((https?:\/\/\S+)\)/,
                    );
                    if (match) {
                      return {
                        type: "youtube_video",
                        raw: match[0],
                        url: match[1],
                      };
                    }
                    return undefined;
                  },
                  renderer(token: any) {
                    return `<div data-youtube-video data-url="${token.url}"></div>`;
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
