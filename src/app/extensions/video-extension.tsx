import { useLocalAsset } from "@/app/hooks/use-local-asset";
import { uiDispatch } from "@/store/ui.store";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { useEffect, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { VideoIcon } from "@phosphor-icons/react/dist/csr/Video";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { formatObsidianLink } from "@/lib/obsidian-links";

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

	const [imgLoading, setImgLoading] = useState(true);
	const [imgError, setImgError] = useState(false);

	useEffect(() => {
		setImgLoading(true);
		setImgError(false);
	}, [displaySrc]);

	const isLoading = loading || imgLoading;
	const isError = error || imgError;

	const handleOpenPreview = () => {
		if (!displaySrc) return;
		uiDispatch.openMediaPreview([{ src: displaySrc, type: "video", title }]);
	};

	return (
		<NodeViewWrapper className="flex relative flex-col items-center my-4 group">
			<div className="relative w-full max-w-2xl rounded-lg overflow-hidden bg-floating-overlay aspect-video shadow-md">
				{isLoading && !isError && (
					<div className="flex absolute inset-0 justify-center items-center bg-muted/30">
						<CircleNotchIcon
							aria-hidden="true"
							size={24}
							className="animate-spin text-muted-foreground"
						/>
					</div>
				)}
				{isError && (
					<div className="flex flex-col gap-2 justify-center items-center p-8 h-full text-muted-foreground">
						<VideoIcon aria-hidden="true" size={32} />
						<span className="text-sm">Failed to load video</span>
					</div>
				)}
				{!isError && displaySrc && (
					<video
						src={displaySrc}
						aria-label={title || "Embedded video"}
						className={`w-full h-full ${isLoading ? "opacity-0" : "opacity-100"}`}
						onLoadedData={() => setImgLoading(false)}
						onError={() => {
							setImgLoading(false);
							setImgError(true);
						}}
						controls
					/>
				)}

				{!isError && !isLoading && (
					<div className="hidden absolute top-2 right-2 gap-1 p-1 rounded group-hover:flex group-focus-within:flex bg-tooltip-background/90">
						<button
							type="button"
							aria-label={
								title ? `Open video preview: ${title}` : "Open video preview"
							}
							className="p-1 text-tooltip-foreground rounded hover:bg-tooltip-hover"
							onClick={handleOpenPreview}
							title="Expand"
						>
							<ArrowsOutIcon aria-hidden="true" size={14} />
						</button>
						<button
							type="button"
							aria-label={title ? `Delete video: ${title}` : "Delete video"}
							title="Delete video"
							onClick={() => deleteNode()}
							className="p-1 text-danger rounded hover:bg-danger-subtle"
						>
							<TrashIcon aria-hidden="true" size={14} />
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
				parseHTML: (element) =>
					element.getAttribute("data-obsidian-embed") === "true",
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
