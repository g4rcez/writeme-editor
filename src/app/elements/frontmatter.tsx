import { negate } from "@g4rcez/components";
import {
  mergeAttributes,
  Node,
  NodeViewContent,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { useEffect, useMemo, useState } from "react";
import { FrontmatterBuilder } from "./frontmatter-builder";
import { type BundledLanguage } from "shiki";
import * as YAML from "yaml";
import { globalDispatch, globalState } from "@/store/global.store";
import { getEditorNote } from "@/lib/editor-storage";
import { getThemeForMode, ShikiPlugin, CodeBlockFrame } from "./code-block";

const FRONTMATTER_ID = "frontmatter-block";

const FRONTMATTER_BUTTON_ID = `${FRONTMATTER_ID}-button`;

const FrontmatterView = (props: any) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { node, editor, getPos } = props;
  const content = node.textContent;

  useEffect(() => {
    try {
      const parsed = YAML.parse(content) || {};
      setError(null);
      const note = getEditorNote(editor);
      if (!note) return;
      if (
        parsed.title &&
        typeof parsed.title === "string" &&
        parsed.title !== note.title
      ) {
        globalDispatch.syncNoteState({ ...note, title: parsed.title } as any);
      }
      if (parsed.tags) {
        let newTags: string[] = [];
        if (Array.isArray(parsed.tags)) {
          newTags = parsed.tags
            .map((t: any) => String(t).trim())
            .filter((t: string) => t.length > 0);
        } else if (typeof parsed.tags === "string") {
          newTags = parsed.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0);
        }
        const currentTags = [...note.tags].sort().join(",");
        const sortedNewTags = [...newTags].sort().join(",");
        if (sortedNewTags !== currentTags) {
          globalDispatch.syncNoteState({ ...note, tags: newTags } as any);
        }
      }
      const currentMetadataStr = JSON.stringify(note.metadata || {});
      const newMetadataStr = JSON.stringify(parsed);
      if (currentMetadataStr !== newMetadataStr) {
        globalDispatch.syncNoteState({ ...note, metadata: parsed } as any);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [content, editor.storage.note]);

  const toggleCollapse = () => setIsCollapsed(negate);

  const convertToText = () => {
    const pos = getPos();
    const lines = `---\n${node.textContent}\n---`.split("\n");
    editor
      .chain()
      .focus()
      .command(({ tr, dispatch }: any) => {
        if (dispatch) {
          const paragraphs = lines.map((line: string) =>
            editor.schema.nodes.paragraph.create(
              {},
              line ? editor.schema.text(line) : undefined,
            ),
          );
          tr.replaceWith(pos, pos + node.nodeSize, paragraphs);
        }
        return true;
      })
      .run();
  };

  const onSave = (yaml: string) => {
    const pos = getPos();
    editor
      .chain()
      .focus()
      .command(({ tr, dispatch }: any) => {
        if (dispatch) {
          const from = pos + 1;
          const to = pos + node.nodeSize - 1;
          tr.replaceWith(from, to, yaml ? editor.schema.text(yaml) : []);
        }
        return true;
      })
      .run();
  };

  const metadataCount = useMemo(() => {
    try {
      return Object.keys(YAML.parse(content) || {}).length;
    } catch {
      return 0;
    }
  }, [content]);

  return (
    <>
      <CodeBlockFrame
        isTransparent
        id={FRONTMATTER_ID}
        isBodyVisible={!isCollapsed}
        lineCount={props.node.textContent.split("\n").length}
        footer={
          <div className="flex justify-between items-center w-full border-t border-card-border">
            <div className="flex gap-2 items-center py-2 px-4 text-xs text-muted-foreground">
              <GearIcon size={14} />
              <span>Metadata ({metadataCount} keys)</span>
              {error && (
                <span className="ml-1 font-bold text-destructive">!</span>
              )}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={convertToText}
                title="Convert frontmatter to plain text"
                className="py-2 px-4 text-xs font-medium bg-transparent transition-colors text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              >
                Convert to text
              </button>
              <button
                type="button"
                onClick={() => setBuilderOpen(true)}
                className="flex gap-1 items-center py-2 px-4 text-xs font-medium bg-transparent transition-colors text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              >
                <PencilSimpleIcon size={14} />
                Edit
              </button>
              <button
                type="button"
                onClick={toggleCollapse}
                id={FRONTMATTER_BUTTON_ID}
                className="flex gap-1 items-center py-2 px-4 text-xs font-medium bg-transparent transition-colors text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              >
                {isCollapsed ? <span>Expand</span> : <span>Collapse</span>}
                {isCollapsed ? (
                  <CaretDownIcon size={14} />
                ) : (
                  <CaretUpIcon size={14} />
                )}
              </button>
            </div>
          </div>
        }
      >
        <NodeViewContent className="font-mono whitespace-pre bg-transparent outline-none content is-editable code-content-renderer" />
        {error && (
          <div className="flex gap-2 items-center mt-2 text-xs text-destructive">
            <WarningCircleIcon size={14} />
            <span>{error}</span>
          </div>
        )}
      </CodeBlockFrame>
      <FrontmatterBuilder
        onSave={onSave}
        content={content}
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
      />
    </>
  );
};

export const Frontmatter = Node.create({
  name: "frontmatter",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  isolating: true,
  atom: false,

  addAttributes() {
    return {
      language: {
        default: "yaml",
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write("---\n");
          state.text(node.textContent, false);
          state.write("\n---\n");
          state.closeBlock(node);
        },
        parse: {
          setup(marked: any) {
            marked.use({
              extensions: [
                {
                  name: "frontmatter",
                  level: "block",
                  start(src: string) {
                    return src.startsWith("---") ? 0 : undefined;
                  },
                  tokenizer(src: string, tokens: any[]) {
                    if (tokens.some((t: any) => t.type !== "space"))
                      return undefined;
                    const match = src.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
                    if (match) {
                      return {
                        type: "frontmatter",
                        raw: match[0],
                        content: match[1],
                      };
                    }
                    return undefined;
                  },
                  renderer(token: any) {
                    return `<pre data-type="frontmatter" data-language="yaml"><code>${token.content}</code></pre>`;
                  },
                },
              ],
            });
          },
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        priority: 1000,
        preserveWhitespace: "full",
        tag: 'pre[data-type="frontmatter"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-type": "frontmatter",
        "data-language": "yaml",
      }),
      ["code", {}, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FrontmatterView);
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-f": () => {
        const frontMatterBlock = document.getElementById(FRONTMATTER_ID);
        if (!frontMatterBlock) this.editor.commands.insertContent("---\n\n---");
        const button = document.getElementById(FRONTMATTER_BUTTON_ID);
        if (button) {
          button?.click();
          button?.scrollIntoView();
          return true;
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      ShikiPlugin({
        name: this.name,
        renderBackground: false,
        defaultLanguage: "yaml" as BundledLanguage,
        getCurrentTheme: () => getThemeForMode(globalState().theme),
      }),
    ];
  },
});
