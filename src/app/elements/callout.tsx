import { Alert, type AlertProps } from "@g4rcez/components";
import { FireIcon } from "@phosphor-icons/react/dist/csr/Fire";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { LightbulbIcon } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";
import { Fragment, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

type AlertTheme = NonNullable<AlertProps["theme"]>;

export const ADMONITION_MAP = {
    note: { label: "NOTE", theme: "neutral" as AlertTheme, Icon: InfoIcon },
    tip: { label: "TIP", theme: "success" as AlertTheme, Icon: LightbulbIcon },
    info: { label: "INFO", theme: "info" as AlertTheme, Icon: WarningCircleIcon },
    warning: { label: "WARNING", theme: "warn" as AlertTheme, Icon: WarningIcon },
    danger: { label: "DANGER", theme: "danger" as AlertTheme, Icon: FireIcon },
} as const;

export type AdmonitionType = keyof typeof ADMONITION_MAP;

export interface CalloutOptions {
    HTMLAttributes: Record<string, unknown>;
}

const DOCUSAURUS_OPEN_RE = /^:::(note|tip|info|warning|danger)\s*$/;
const DOCUSAURUS_CLOSE_RE = /^:::\s*$/;

export function parseDocusaurusAdmonitions(element: HTMLElement): void {
    const children = Array.from(element.children) as HTMLElement[];
    for (const child of children) {
        if (child.parentElement !== element) continue;
        if (child.tagName !== "P") continue;
        const text = child.textContent?.trim() ?? "";
        const match = text.match(DOCUSAURUS_OPEN_RE);
        if (!match) continue;
        const type = match[1]!;
        const contentNodes: Element[] = [];
        let cursor: Element | null = child.nextElementSibling;
        let closingEl: Element | null = null;
        while (cursor) {
            if (cursor.tagName === "P" && DOCUSAURUS_CLOSE_RE.test(cursor.textContent?.trim() ?? "")) {
                closingEl = cursor;
                break;
            }
            contentNodes.push(cursor);
            cursor = cursor.nextElementSibling;
        }
        if (!closingEl) continue;
        const div = document.createElement("div");
        div.setAttribute("data-type", "callout");
        div.setAttribute("data-callout-type", type);
        for (const n of contentNodes) div.appendChild(n);
        if (div.childElementCount === 0) {
            div.appendChild(document.createElement("p"));
        }
        child.replaceWith(div);
        closingEl?.remove();
    }
}

export const inputRegex = /^\|>(info|danger|success|primary|default|note|tip|important|warning|caution)? \s?(.*)$/;

const CalloutNodeView = ({ node }: NodeViewProps) => {
    const type = node.attrs.type as string;
    const config = ADMONITION_MAP[type as AdmonitionType];
    if (!config) {
        return (
            <NodeViewWrapper>
                <div className={`callout callout-${type}`}>
                    <NodeViewContent />
                </div>
            </NodeViewWrapper>
        );
    }
    return (
        <NodeViewWrapper>
            <Alert theme={config.theme} title={config.label} Icon={<config.Icon size={20} />}>
                <NodeViewContent />
            </Alert>
        </NodeViewWrapper>
    );
};

export const Callout = Node.create<CalloutOptions>({
    name: "callout",
    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },
    content: "paragraph+",
    group: "block",
    defining: true,
    addAttributes() {
        return {
            type: {
                default: "info",
                parseHTML: (element) => element.getAttribute("data-callout-type") || "info",
                renderHTML: (attributes) => ({
                    "data-callout-type": attributes.type,
                }),
            },
        };
    },

    parseHTML() {
        return [{ tag: `div[data-type="callout"]`, priority: 51 }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            "div",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                "data-type": "callout",
                "data-callout-type": node.attrs.type,
                class: `callout callout-${node.attrs.type}`,
            }),
            0,
        ];
    },
    addStorage() {
        return {
            markdown: {
                serialize(state: any, node: any) {
                    const type: string = node.attrs.type ?? "note";
                    if (type in ADMONITION_MAP) {
                        state.write(`:::${type}\n`);
                        state.renderContent(node);
                        state.ensureNewLine();
                        // Null the internal closed pointer so flushClose() doesn't inject a blank line before the closing fence.
                        state.closed = null;
                        state.write(":::");
                        state.closeBlock(node);
                    } else {
                        const gfmFallback: Record<string, string> = {
                            success: "TIP",
                            primary: "IMPORTANT",
                            default: "NOTE",
                            important: "IMPORTANT",
                            caution: "CAUTION",
                        };
                        state.wrapBlock("> ", null, node, () => {
                            state.write(`[!${gfmFallback[type] ?? "NOTE"}]\n`);
                            state.renderContent(node);
                        });
                    }
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        parseDocusaurusAdmonitions(element);
                        element.querySelectorAll("blockquote").forEach((blockquote) => {
                            const firstP = blockquote.querySelector("p");
                            if (!firstP) return;
                            const textContent = firstP.textContent ?? "";
                            if (!/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(textContent)) return;
                            const typeMatch = textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
                            if (!typeMatch) return;
                            const type = typeMatch[1]!.toLowerCase();
                            firstP.innerHTML = firstP.innerHTML
                                .replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](<br\s*\/?>\s*)?\n?/i, "")
                                .trim();
                            if (!firstP.innerHTML.trim()) {
                                firstP.remove();
                            }
                            const div = document.createElement("div");
                            div.setAttribute("data-type", "callout");
                            div.setAttribute("data-callout-type", type);
                            div.innerHTML = blockquote.innerHTML;
                            blockquote.replaceWith(div);
                        });
                    },
                },
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            "Mod-Shift-c": () => this.editor.commands.toggleWrap(this.name),
        };
    },

    addProseMirrorPlugins() {
        const GFM_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;
        const pluginKey = new PluginKey("callout-gfm");
        return [
            new Plugin({
                key: pluginKey,
                appendTransaction(transactions, _oldState, newState) {
                    if (!transactions.some((tr) => tr.docChanged)) return null;
                    if (transactions.some((tr) => tr.getMeta(pluginKey))) return null;

                    type Match = {
                        pos: number;
                        size: number;
                        replacement: ProseMirrorNode;
                    };
                    const matches: Match[] = [];

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name !== "blockquote") return;
                        const firstChild = node.firstChild;
                        if (!firstChild || firstChild.type.name !== "paragraph") return;
                        const m = firstChild.textContent.match(GFM_RE);
                        if (!m) return;
                        const calloutNodeType = newState.schema.nodes.callout;
                        if (!calloutNodeType) return;

                        const prefixLen = m[0]!.length;
                        const type = m[1]!.toLowerCase();
                        const paragraphs: ProseMirrorNode[] = [];

                        node.forEach((child, _, i) => {
                            if (i === 0) {
                                const inlines: ProseMirrorNode[] = [];
                                let skip = prefixLen;
                                child.forEach((inline) => {
                                    if (skip > 0 && inline.isText) {
                                        const t = inline.text!;
                                        if (skip >= t.length) {
                                            skip -= t.length;
                                        } else {
                                            const rest = t.slice(skip).replace(/^\s+/, "");
                                            if (rest) inlines.push((inline as any).withText(rest));
                                            skip = 0;
                                        }
                                    } else if (skip === 0) {
                                        inlines.push(inline);
                                    }
                                });
                                if (inlines.length > 0) {
                                    paragraphs.push(child.copy(Fragment.from(inlines)));
                                }
                            } else {
                                paragraphs.push(child);
                            }
                        });

                        if (paragraphs.length === 0) {
                            paragraphs.push(newState.schema.nodes.paragraph!.create());
                        }

                        matches.push({
                            pos,
                            size: node.nodeSize,
                            replacement: calloutNodeType.create({ type }, Fragment.from(paragraphs)),
                        });
                    });

                    if (matches.length === 0) return null;

                    // Track which match (if any) contained the cursor before conversion
                    const { from: selFrom } = newState.selection;
                    const cursorMatch = matches.find(({ pos, size }) => selFrom >= pos && selFrom <= pos + size);

                    const tr = newState.tr;
                    for (const { pos, size, replacement } of [...matches].reverse()) {
                        tr.replaceWith(pos, pos + size, replacement);
                    }

                    // After replaceWith the cursor is mapped outside the callout — restore it inside
                    if (cursorMatch) {
                        const mappedPos = tr.mapping.map(cursorMatch.pos);
                        try {
                            tr.setSelection(TextSelection.near(tr.doc.resolve(mappedPos + 1)));
                        } catch (_) {
                            /* ignore invalid positions */
                        }
                    }

                    tr.setMeta(pluginKey, true);
                    return tr;
                },
            }),
        ];
    },

    addInputRules() {
        return [
            wrappingInputRule({
                find: inputRegex,
                type: this.type,
                getAttributes: (match) => {
                    const type = match[1] || "info";
                    return { type };
                },
            }),
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CalloutNodeView);
    },
});
