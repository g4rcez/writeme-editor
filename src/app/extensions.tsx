import type { BundledTheme } from "shiki";
import { type AnyExtension, mergeAttributes, nodeInputRule, PasteRule } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import FileHandler from "@tiptap/extension-file-handler";
import { Heading } from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import { OrderedList, TaskList } from "@tiptap/extension-list";
import { InlineMath } from "@tiptap/extension-mathematics";
import Mention from "@tiptap/extension-mention";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { UniqueID } from "@tiptap/extension-unique-id";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import { ImageExtension } from "@/app/extensions/image-extension";
import { PdfExtension } from "@/app/extensions/pdf-extension";
import { VideoExtension } from "@/app/extensions/video-extension";
import { createAttachmentDirectory, createAttachmentRelativePath } from "@/lib/attachment-paths";
import { getUrlNamespace, innerUrl } from "@/lib/encoding";
import { isElectron } from "@/lib/is-electron";
import { formatObsidianLink, parseObsidianLinkBody } from "@/lib/obsidian-links";
import { globalState } from "@/store/global.store";
import { ReplacerCommands } from "./commands/commands";
import { Blockquote } from "./elements/blockquote";
import { Callout } from "./elements/callout";
import { ShikiBlock } from "./elements/code-block";
import { ColorCode } from "./elements/color-code";
import { ColorReplacer } from "./elements/color-replacer";
import { Frontmatter } from "./elements/frontmatter";
import { MentionNodeView } from "./elements/mention";
import { TaskListItem } from "./elements/task-list-item";
import { YoutubeBlock } from "./elements/youtube-block";
import { AssetCleanup } from "./extensions/asset-cleanup";
import { DomainLink } from "./extensions/domain-link";
import { EmojiPicker } from "./extensions/emoji-picker";
import { Hashtag } from "./extensions/hashtag";
import { LinkMark } from "./extensions/link-mark";
import { SearchAndReplace } from "./extensions/search-replace";
import { SlashCommand } from "./extensions/slash-command";
import { Subscript } from "./extensions/subscript";
import { suggestion } from "./extensions/suggestion";
import { Markdown } from "./extensions/tiptap-markdown/Markdown";

const mentionNoteNamespacePattern = /^(?:https?:\/\/[^/]+\/)?@+mention\/note\//;

function normalizeMentionPath(path: string): string {
    return path
        .replace(getUrlNamespace("mention"), "")
        .replace(/^\/@+mention\/note\//, "/note/")
        .replace(mentionNoteNamespacePattern, "/note/");
}

export const handlePasteImage = async (currentEditor: any) => {
    if (!isElectron()) return false;
    const imageData = await window.electronAPI.notes.clipboardImage();
    if (!imageData) return false;
    const state = globalState();
    const projectDir = state.directory;
    const noteTitle = state.note?.title || "untitled";
    if (!projectDir) return false;
    const targetDir = createAttachmentDirectory(projectDir, noteTitle);
    try {
        await window.electronAPI.fs.mkdir(targetDir);
        const dirContents = await window.electronAPI.fs.readDir(targetDir);
        const index = dirContents.entries.filter((e: any) => e.type === "file").length + 1;
        const filename = `${index}.png`;
        const absolutePath = `${targetDir}/${filename}`;
        const result = await window.electronAPI.fs.writeImage(absolutePath, imageData);
        if (result.success) {
            const src = createAttachmentRelativePath(noteTitle, filename);
            currentEditor.chain().insertContent({ type: "image", attrs: { src } }).focus().run();
            return true;
        }
    } catch (e) {
        console.error("Failed to save pasted image", e);
    }
    return false;
};

export const handleMediaFile = async (
    currentEditor: any,
    file: File,
    pos: number | null = null,
    offset: number = 0,
) => {
    if (!currentEditor) {
        console.error("[handleMediaFile] no editor");
        return;
    }
    const insertPos = pos !== null ? pos : currentEditor.state.selection.anchor;
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = async () => {
        let src = fileReader.result as string;
        if (isElectron()) {
            const state = globalState();
            const projectDir = state.directory;
            const noteTitle = state.note?.title || "untitled";
            if (projectDir) {
                const targetDir = createAttachmentDirectory(projectDir, noteTitle);
                try {
                    await window.electronAPI.fs.mkdir(targetDir);
                    const dirContents = await window.electronAPI.fs.readDir(targetDir);
                    const index = dirContents.entries.filter((e: any) => e.type === "file").length + 1 + offset;
                    const ext = file.name.split(".").pop() || "png";
                    const filename = `${Date.now()}_${index}.${ext}`;
                    const absolutePath = `${targetDir}/${filename}`;
                    const result = await window.electronAPI.fs.writeImage(absolutePath, src);
                    if (result.success) {
                        src = createAttachmentRelativePath(noteTitle, filename);
                    }
                } catch (e) {
                    console.error("Failed to save media to filesystem", e);
                }
            }
        }
        let type = "image";
        if (file.type.startsWith("video/")) {
            type = "video";
        } else if (file.type === "application/pdf") {
            type = "pdf";
        }
        currentEditor
            .chain()
            .insertContentAt(insertPos, { type, attrs: { src, title: file.name } })
            .focus()
            .run();
    };
};

export const createExtensions = (getCurrentTheme: () => BundledTheme): AnyExtension[] => {
    return [
        Frontmatter,
        ColorCode,
        StarterKit.configure({
            // @ts-expect-error
            inlineMath: false,
            heading: false,
            codeBlock: false,
            blockquote: false,
            orderedList: false,
            link: false,
            undoRedo: { depth: 20 },
            code: { HTMLAttributes: { class: "inline-code" } },
            bulletList: { keepMarks: true, keepAttributes: true },
        }),
        OrderedList.configure({ keepMarks: true, keepAttributes: true }).extend({
            renderHTML({ HTMLAttributes, node }) {
                const start = node.attrs.start ?? 1;
                return [
                    "ol",
                    mergeAttributes(HTMLAttributes, {
                        style: `counter-reset: section ${start - 1}`,
                    }),
                    0,
                ];
            },
        }),
        Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        UniqueID.configure({ types: ["heading"] }),
        TableKit.configure({
            table: {
                resizable: true,
                renderWrapper: true,
                lastColumnResizable: false,
                allowTableNodeSelection: true,
            },
        }),
        Highlight,
        Blockquote,
        ColorReplacer,
        Color.configure({ types: [TextStyle.name] }),
        ImageExtension,
        VideoExtension,
        DomainLink,
        LinkMark,
        PdfExtension,
        FileHandler.configure({
            allowedMimeTypes: [
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
                "video/mp4",
                "video/webm",
                "application/pdf",
            ],
            onDrop: (currentEditor, files, pos) => {
                files.forEach((file, index) => {
                    handleMediaFile(currentEditor, file, pos, index);
                });
            },
            onPaste: (currentEditor, files, htmlContent) => {
                files.forEach((file, index) => {
                    if (!htmlContent) {
                        handleMediaFile(currentEditor, file, null, index);
                    }
                });
            },
        }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder: "Your text here..." }),
        Typography.configure({
            raquo: false,
            multiplication: false,
            closeDoubleQuote: false,
            closeSingleQuote: false,
            openDoubleQuote: false,
            openSingleQuote: false,
        }),
        ShikiBlock.configure({
            getCurrentTheme,
            themeAware: true,
            exitOnArrowDown: true,
            exitOnTripleEnter: true,
            defaultTheme: getCurrentTheme(),
        }),
        InlineMath,
        Subscript,
        TaskList,
        TaskListItem,
        YoutubeBlock,
        Callout,
        Hashtag,
        AssetCleanup,
        SearchAndReplace.configure({
            searchResultClass: "search-result",
            caseSensitive: false,
        }),
        SlashCommand,
        EmojiPicker,
        ReplacerCommands,
        GlobalDragHandle.configure({ dragHandleWidth: 24, scrollTreshold: 100 }),
        Mention.extend({
            addAttributes() {
                return {
                    id: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("data-id"),
                        renderHTML: (attributes) => {
                            if (!attributes.id) {
                                return {};
                            }
                            return { "data-id": attributes.id };
                        },
                    },
                    label: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("data-label"),
                        renderHTML: (attributes) => {
                            if (!attributes.label) {
                                return {};
                            }
                            return { "data-label": attributes.label };
                        },
                    },
                    path: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("href") || element.getAttribute("data-path"),
                        renderHTML: (attributes) => {
                            if (!attributes.path) {
                                return {};
                            }
                            return { "data-path": attributes.path };
                        },
                    },
                    obsidianTarget: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("data-obsidian-target"),
                        renderHTML: (attributes) =>
                            attributes.obsidianTarget ? { "data-obsidian-target": attributes.obsidianTarget } : {},
                    },
                    obsidianAlias: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("data-obsidian-alias"),
                        renderHTML: (attributes) =>
                            attributes.obsidianAlias ? { "data-obsidian-alias": attributes.obsidianAlias } : {},
                    },
                    obsidianSubpath: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("data-obsidian-subpath"),
                        renderHTML: (attributes) =>
                            attributes.obsidianSubpath ? { "data-obsidian-subpath": attributes.obsidianSubpath } : {},
                    },
                    obsidianEmbed: {
                        default: false,
                        parseHTML: (element) => element.getAttribute("data-obsidian-embed") === "true",
                        renderHTML: (attributes) => (attributes.obsidianEmbed ? { "data-obsidian-embed": "true" } : {}),
                    },
                };
            },
            parseHTML() {
                return [
                    { tag: 'span[data-type="mention"]', priority: 51 },
                    { tag: 'a[data-type="mention"]', priority: 51 },
                ];
            },
            renderText({ node }) {
                return node.attrs.label ?? node.attrs.id;
            },
            renderHTML({ node }) {
                const label = node.attrs.label ?? node.attrs.id;
                const path = (node.attrs.path as string) ?? innerUrl(node.attrs.id, "mention");
                const normalizedPath = normalizeMentionPath(path);
                const obsidianAttributes = node.attrs.obsidianTarget
                    ? {
                          "data-obsidian-link": "true",
                          "data-obsidian-target": node.attrs.obsidianTarget,
                          "data-obsidian-alias": node.attrs.obsidianAlias ?? "",
                          "data-obsidian-subpath": node.attrs.obsidianSubpath ?? "",
                          "data-obsidian-embed": node.attrs.obsidianEmbed ? "true" : "false",
                      }
                    : {};
                return [
                    "a",
                    {
                        class: "mention",
                        target: "_parent",
                        "data-label": label,
                        "data-type": "mention",
                        "data-id": node.attrs.id,
                        title: "writeme-mention:" + node.attrs.id,
                        href: normalizedPath,
                        "data-path": normalizedPath,
                        ...obsidianAttributes,
                    },
                    label,
                ];
            },
            addNodeView() {
                return ReactNodeViewRenderer(MentionNodeView);
            },
            addPasteRules() {
                return [
                    new PasteRule({
                        find: /(!)?\[\[([^\]\n]+)\]\]/g,
                        handler: ({ match, chain, range }: any) => {
                            if (match[2]) {
                                const parsed = parseObsidianLinkBody(match[2], Boolean(match[1]));
                                chain()
                                    .insertContentAt(range, {
                                        type: this.type.name,
                                        attrs: {
                                            id: parsed.target,
                                            label: parsed.display,
                                            path: parsed.target,
                                            obsidianTarget: parsed.target,
                                            obsidianAlias: parsed.alias,
                                            obsidianSubpath: parsed.subpath,
                                            obsidianEmbed: parsed.embed,
                                        },
                                    })
                                    .run();
                            }
                        },
                    }),
                    new PasteRule({
                        find: /\[([^\]]+)\]\(([^)"]+)(?: "writeme-mention:([^"]+)")?\)/g,
                        handler: ({ match, chain, range }: any) => {
                            if (match[3]) {
                                chain()
                                    .insertContentAt(range, {
                                        type: this.type.name,
                                        attrs: { label: match[1], path: match[2], id: match[3] },
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
                        find: /(!)?\[\[([^\]\n]+)\]\]$/,
                        type: this.type,
                        getAttributes: (match) => {
                            const parsed = parseObsidianLinkBody(match[2] ?? "", Boolean(match[1]));
                            return {
                                id: parsed.target,
                                label: parsed.display,
                                path: parsed.target,
                                obsidianTarget: parsed.target,
                                obsidianAlias: parsed.alias,
                                obsidianSubpath: parsed.subpath,
                                obsidianEmbed: parsed.embed,
                            };
                        },
                    }),
                    nodeInputRule({
                        find: /\[([^\]]+)\]\(([^)"]+) "writeme-mention:([^"]+)"\)$/,
                        type: this.type,
                        getAttributes: (match) => {
                            return { label: match[1], path: match[2], id: match[3] };
                        },
                    }),
                ];
            },
        }).configure({
            suggestion: suggestion,
            HTMLAttributes: { class: "mention" },
            ...({
                markdown: {
                    serialize(state: any, node: any) {
                        if (node && node.attrs) {
                            if (node.attrs.obsidianTarget || node.attrs.obsidianSubpath) {
                                state.write(
                                    formatObsidianLink({
                                        embed: Boolean(node.attrs.obsidianEmbed),
                                        target: node.attrs.obsidianTarget,
                                        subpath: node.attrs.obsidianSubpath,
                                        alias: node.attrs.obsidianAlias,
                                    }),
                                );
                                return;
                            }
                            const label = node.attrs.label ?? node.attrs.id;
                            const path = node.attrs.path ?? innerUrl(node.attrs.id, "mention");
                            const id = node.attrs.id;
                            state.write(`[${label}](${normalizeMentionPath(path)} "writeme-mention:${id}")`);
                        }
                    },
                },
            } as any),
        }),
        Markdown,
        CharacterCount,
    ];
};
