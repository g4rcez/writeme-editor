import { useLocalAsset } from "@/app/hooks/use-local-asset";
import { uiDispatch } from "@/store/ui.store";
import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ArrowDownLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowDownLeft";
import { ArrowDownRightIcon } from "@phosphor-icons/react/dist/csr/ArrowDownRight";
import { ArrowUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUpLeft";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { ImageBrokenIcon } from "@phosphor-icons/react/dist/csr/ImageBroken";
import { TextAlignCenterIcon } from "@phosphor-icons/react/dist/csr/TextAlignCenter";
import { TextAlignLeftIcon } from "@phosphor-icons/react/dist/csr/TextAlignLeft";
import { TextAlignRightIcon } from "@phosphor-icons/react/dist/csr/TextAlignRight";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useRef } from "react";

const IMAGE_MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const ImageView = (props: any) => {
  const { node, updateAttributes, deleteNode, selected } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const src: string = node.attrs.src ?? "";
  const alt: string = node.attrs.alt ?? "";
  const align: string = node.attrs.align ?? "center";
  const width: string | null = node.attrs.width ?? null;

  const { loading, error, displaySrc } = useLocalAsset(src, IMAGE_MIME_MAP);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 50 : 10;
      const current = containerRef.current?.offsetWidth ?? 0;
      const newWidth =
        e.key === "ArrowRight"
          ? Math.max(80, current + step)
          : Math.max(80, current - step);
      updateAttributes({ width: `${newWidth}px` });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected, width]);

  const handleOpenPreview = () => {
    if (!displaySrc) return;
    uiDispatch.openMediaPreview([
      { src: displaySrc, type: "image", title: alt },
    ]);
  };

  const makeResizeHandler =
    (corner: "nw" | "ne" | "sw" | "se"): React.MouseEventHandler =>
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = containerRef.current?.offsetWidth ?? 0;

      const onMouseMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - startX;
        const rawWidth =
          corner === "ne" || corner === "se"
            ? startWidth + deltaX
            : startWidth - deltaX;
        const newWidth = Math.max(80, rawWidth);
        updateAttributes({ width: `${newWidth}px` });
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle
      className="flex relative flex-col items-center my-4 group"
    >
      <div
        ref={containerRef}
        className="inline-block relative mx-auto"
        style={width ? { width } : undefined}
      >
        {loading && !error && (
          <div className="flex absolute inset-0 justify-center items-center rounded bg-muted/30">
            <CircleNotchIcon
              size={24}
              className="animate-spin text-muted-foreground"
            />
          </div>
        )}
        {error && (
          <div className="flex flex-col gap-2 justify-center items-center p-8 rounded bg-muted/30 text-muted-foreground">
            <ImageBrokenIcon size={32} />
            <span className="text-sm">Failed to load image</span>
          </div>
        )}
        {!error && displaySrc && (
          <img
            src={displaySrc}
            alt={alt}
            className={`block w-full rounded cursor-pointer ${loading ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              // Only trigger error if we actually had a valid-looking source
              if (displaySrc) {
                setLoading(false);
                setError(true);
              }
            }}
            onClick={handleOpenPreview}
          />
        )}

        {/* Unified toolbar — top right */}
        {!error && !loading && (
          <div className="hidden absolute top-2 right-2 gap-1 p-1 rounded group-hover:flex bg-black/50">
            <button
              title="Align left"
              onClick={() => updateAttributes({ align: "left" })}
              className={`p-1 rounded text-white hover:bg-white/20 ${align === "left" ? "bg-white/30" : ""}`}
            >
              <TextAlignLeftIcon size={14} />
            </button>
            <button
              title="Align center"
              onClick={() => updateAttributes({ align: "center" })}
              className={`p-1 rounded text-white hover:bg-white/20 ${align === "center" ? "bg-white/30" : ""}`}
            >
              <TextAlignCenterIcon size={14} />
            </button>
            <button
              title="Align right"
              onClick={() => updateAttributes({ align: "right" })}
              className={`p-1 rounded text-white hover:bg-white/20 ${align === "right" ? "bg-white/30" : ""}`}
            >
              <TextAlignRightIcon size={14} />
            </button>
            <div className="mx-0.5 w-px bg-white/20" />
            <button
              className="p-1 text-white rounded hover:bg-white/20"
              onClick={handleOpenPreview}
              title="Expand"
            >
              <ArrowsOutIcon size={14} />
            </button>
            <button
              title="Delete image"
              onClick={() => deleteNode()}
              className="p-1 text-red-400 rounded hover:bg-white/20"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        )}

        {/* Corner resize handles */}
        {!error && !loading && (
          <>
            <div
              className="flex absolute -top-1 -left-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 border-black/30 cursor-nwse-resize"
              onMouseDown={makeResizeHandler("nw")}
            >
              <ArrowUpLeftIcon size={10} className="text-black/70" />
            </div>
            <div
              className="flex absolute -top-1 -right-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 border-black/30 cursor-nesw-resize"
              onMouseDown={makeResizeHandler("ne")}
            >
              <ArrowUpRightIcon size={10} className="text-black/70" />
            </div>
            <div
              className="flex absolute -bottom-1 -left-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 border-black/30 cursor-nesw-resize"
              onMouseDown={makeResizeHandler("sw")}
            >
              <ArrowDownLeftIcon size={10} className="text-black/70" />
            </div>
            <div
              className="flex absolute -right-1 -bottom-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 border-black/30 cursor-nwse-resize"
              onMouseDown={makeResizeHandler("se")}
            >
              <ArrowDownRightIcon size={10} className="text-black/70" />
            </div>
          </>
        )}
      </div>

      <input
        type="text"
        value={alt}
        onChange={(e) => updateAttributes({ alt: e.target.value })}
        placeholder="Add caption..."
        className="mt-2 w-full max-w-sm text-sm text-center bg-transparent border-none outline-none focus:border-b text-muted-foreground placeholder:text-muted-foreground/50 focus:border-muted-foreground/30"
      />
    </NodeViewWrapper>
  );
};

export const ImageExtension = Image.extend({
  inline: false,
  group: "block",

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width") || el.style.width || null,
        renderHTML: (attrs) =>
          attrs.width
            ? { width: attrs.width, style: `width:${attrs.width}` }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      { "data-type": "image-block", "data-align": HTMLAttributes.align },
      [
        "img",
        mergeAttributes({
          src: HTMLAttributes.src,
          alt: HTMLAttributes.alt || "",
          ...(HTMLAttributes.width
            ? {
                width: HTMLAttributes.width,
                style: `width:${HTMLAttributes.width}`,
              }
            : {}),
        }),
      ],
      ["figcaption", {}, HTMLAttributes.alt || ""],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: any, node: any) {
          state.write(`![${node.attrs.alt || ""}](${node.attrs.src || ""})`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
}).configure({
  allowBase64: true,
  resize: { enabled: true, alwaysPreserveAspectRatio: true },
});
