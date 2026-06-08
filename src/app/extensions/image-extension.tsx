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
import { useEffect, useRef, useState } from "react";
import { formatObsidianLink } from "@/lib/obsidian-links";

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

  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgLoading(true);
    setImgError(false);
  }, [displaySrc]);

  const isLoading = loading || imgLoading;
  const isError = error || imgError;

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

  const handleOpenPreviewKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleOpenPreview();
  };

  const resizeImageBy = (delta: number) => {
    const current = containerRef.current?.offsetWidth ?? 0;
    const newWidth = Math.max(80, current + delta);
    updateAttributes({ width: `${newWidth}px` });
  };

  const makeResizeKeyDownHandler =
    (): React.KeyboardEventHandler<HTMLButtonElement> => (e) => {
      if (
        e.key !== "ArrowRight" &&
        e.key !== "ArrowLeft" &&
        e.key !== "Enter" &&
        e.key !== " "
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 50 : 10;
      resizeImageBy(e.key === "ArrowLeft" ? -step : step);
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
        {isLoading && !isError && (
          <div className="flex absolute inset-0 justify-center items-center rounded bg-muted/30">
            <CircleNotchIcon
              aria-hidden="true"
              size={24}
              className="animate-spin text-muted-foreground"
            />
          </div>
        )}
        {isError && (
          <div className="flex flex-col gap-2 justify-center items-center p-8 rounded bg-muted/30 text-muted-foreground">
            <ImageBrokenIcon aria-hidden="true" size={32} />
            <span className="text-sm">Failed to load image</span>
          </div>
        )}
        {!isError && displaySrc && (
          <img
            src={displaySrc}
            alt={alt}
            role="button"
            tabIndex={0}
            aria-label={
              alt ? `Open image preview: ${alt}` : "Open image preview"
            }
            className={`block w-full rounded cursor-pointer ${isLoading ? "opacity-0" : "opacity-100"}`}
            onKeyDown={handleOpenPreviewKeyDown}
            onLoad={() => setImgLoading(false)}
            onError={() => {
              if (displaySrc) {
                setImgLoading(false);
                setImgError(true);
              }
            }}
            onClick={handleOpenPreview}
          />
        )}

        {/* Unified toolbar — top right */}
        {!isError && !isLoading && (
          <div className="hidden absolute top-2 right-2 gap-1 p-1 rounded group-hover:flex group-focus-within:flex bg-black/50">
            <button
              type="button"
              aria-label="Align image left"
              aria-pressed={align === "left"}
              title="Align left"
              onClick={() => updateAttributes({ align: "left" })}
              className={`p-1 rounded text-white hover:bg-white/20 ${align === "left" ? "bg-white/30" : ""}`}
            >
              <TextAlignLeftIcon aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              aria-label="Align image center"
              aria-pressed={align === "center"}
              title="Align center"
              onClick={() => updateAttributes({ align: "center" })}
              className={`p-1 rounded text-white hover:bg-white/20 ${align === "center" ? "bg-white/30" : ""}`}
            >
              <TextAlignCenterIcon aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              aria-label="Align image right"
              aria-pressed={align === "right"}
              title="Align right"
              onClick={() => updateAttributes({ align: "right" })}
              className={`p-1 rounded text-white hover:bg-white/20 ${align === "right" ? "bg-white/30" : ""}`}
            >
              <TextAlignRightIcon aria-hidden="true" size={14} />
            </button>
            <div className="mx-0.5 w-px bg-white/20" aria-hidden="true" />
            <button
              type="button"
              aria-label={
                alt ? `Open image preview: ${alt}` : "Open image preview"
              }
              className="p-1 text-white rounded hover:bg-white/20"
              onClick={handleOpenPreview}
              title="Expand"
            >
              <ArrowsOutIcon aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              aria-label={alt ? `Delete image: ${alt}` : "Delete image"}
              title="Delete image"
              onClick={() => deleteNode()}
              className="p-1 text-red-400 rounded hover:bg-white/20"
            >
              <TrashIcon aria-hidden="true" size={14} />
            </button>
          </div>
        )}

        {/* Corner resize handles */}
        {!isError && !isLoading && (
          <>
            <button
              type="button"
              aria-label="Resize image from top left. Use left and right arrow keys."
              className="flex absolute -top-1 -left-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 focus:opacity-100 border-black/30 cursor-nwse-resize"
              onMouseDown={makeResizeHandler("nw")}
              onKeyDown={makeResizeKeyDownHandler()}
            >
              <ArrowUpLeftIcon
                aria-hidden="true"
                size={10}
                className="text-black/70"
              />
            </button>
            <button
              type="button"
              aria-label="Resize image from top right. Use left and right arrow keys."
              className="flex absolute -top-1 -right-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 focus:opacity-100 border-black/30 cursor-nesw-resize"
              onMouseDown={makeResizeHandler("ne")}
              onKeyDown={makeResizeKeyDownHandler()}
            >
              <ArrowUpRightIcon
                aria-hidden="true"
                size={10}
                className="text-black/70"
              />
            </button>
            <button
              type="button"
              aria-label="Resize image from bottom left. Use left and right arrow keys."
              className="flex absolute -bottom-1 -left-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 focus:opacity-100 border-black/30 cursor-nesw-resize"
              onMouseDown={makeResizeHandler("sw")}
              onKeyDown={makeResizeKeyDownHandler()}
            >
              <ArrowDownLeftIcon
                aria-hidden="true"
                size={10}
                className="text-black/70"
              />
            </button>
            <button
              type="button"
              aria-label="Resize image from bottom right. Use left and right arrow keys."
              className="flex absolute -right-1 -bottom-1 justify-center items-center w-3 h-3 bg-white rounded-sm border shadow opacity-0 group-hover:opacity-100 focus:opacity-100 border-black/30 cursor-nwse-resize"
              onMouseDown={makeResizeHandler("se")}
              onKeyDown={makeResizeKeyDownHandler()}
            >
              <ArrowDownRightIcon
                aria-hidden="true"
                size={10}
                className="text-black/70"
              />
            </button>
          </>
        )}
      </div>

      <input
        type="text"
        aria-label="Image alt text"
        value={alt}
        onChange={(e) => updateAttributes({ alt: e.target.value })}
        placeholder="Add caption..."
        className="mt-2 w-full max-w-sm text-sm text-center bg-transparent border-none focus:border-b text-muted-foreground placeholder:text-muted-foreground/50 focus:border-muted-foreground/30"
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
      obsidianTarget: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-obsidian-target"),
        renderHTML: (attrs) =>
          attrs.obsidianTarget
            ? { "data-obsidian-target": attrs.obsidianTarget }
            : {},
      },
      obsidianAlias: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-obsidian-alias"),
        renderHTML: (attrs) =>
          attrs.obsidianAlias
            ? { "data-obsidian-alias": attrs.obsidianAlias }
            : {},
      },
      obsidianSubpath: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-obsidian-subpath"),
        renderHTML: (attrs) =>
          attrs.obsidianSubpath
            ? { "data-obsidian-subpath": attrs.obsidianSubpath }
            : {},
      },
      obsidianEmbed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-obsidian-embed") === "true",
        renderHTML: (attrs) =>
          attrs.obsidianEmbed ? { "data-obsidian-embed": "true" } : {},
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
