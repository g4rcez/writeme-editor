import { negate } from "@g4rcez/components";
import {
  mergeAttributes,
  Node,
  NodeViewContent,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { AlertCircle, ChevronDown, ChevronUp, Settings } from "lucide-react";
import markdownItFrontMatter from "markdown-it-front-matter";
import { useEffect, useMemo, useState } from "react";
import { BundledLanguage } from "shiki";
import * as YAML from "yaml";
import { globalDispatch, globalState } from "../../store/global.store";
import { Note } from "../../store/note";
import { getThemeForMode, ShikiPlugin, CodeBlockFrame } from "./code-block";

const FrontmatterView = (props: any) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { node, editor } = props;
  const content = node.textContent;

  useEffect(() => {
    try {
      const parsed = YAML.parse(content) || {};
      setError(null);
      const note = (editor.storage as any).note as Note;
      if (!note) return;
      let changed = false;
      if (
        parsed.title &&
        typeof parsed.title === "string" &&
        parsed.title !== note.title
      ) {
        globalDispatch.syncNoteState({ ...note, title: parsed.title } as any);
        changed = true;
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
          changed = true;
        }
      }
      const currentMetadataStr = JSON.stringify(note.metadata || {});
      const newMetadataStr = JSON.stringify(parsed);
      if (currentMetadataStr !== newMetadataStr) {
        globalDispatch.syncNoteState({ ...note, metadata: parsed } as any);
        changed = true;
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [content, editor.storage.note]);

  const toggleCollapse = () => setIsCollapsed(negate);

  const metadataCount = useMemo(() => {
    try {
      return Object.keys(YAML.parse(content) || {}).length;
    } catch {
      return 0;
    }
  }, [content]);

  return (
    <CodeBlockFrame
      isTransparent
      isBodyVisible={!isCollapsed}
      lineCount={props.node.textContent.split("\n").length}
      footer={
        <button
          onClick={toggleCollapse}
          className="flex justify-between items-center py-2 px-4 w-full text-xs font-medium border-t transition-colors text-muted-foreground border-card-border bg-transparent hover:bg-muted/20 hover:text-foreground"
        >
          <div className="flex gap-2 items-center">
            <Settings size={14} />
            <span>Metadata ({metadataCount} keys)</span>
            {error && (
              <span className="ml-1 font-bold text-destructive">!</span>
            )}
          </div>
          <div className="flex gap-1 items-center">
            {isCollapsed ? <span>Expand</span> : <span>Collapse</span>}
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </button>
      }
    >
      <NodeViewContent className="font-mono whitespace-pre outline-none content is-editable code-content-renderer bg-transparent" />
      {error && (
        <div className="flex gap-2 items-center mt-2 text-xs text-destructive">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </CodeBlockFrame>
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
          setup(markdownit: any) {
            markdownit.use(markdownItFrontMatter, () => {});

            markdownit.renderer.rules.front_matter = (
              tokens: any,
              idx: any,
            ) => {
              const token = tokens[idx];
              const content = token.meta || token.content;
              return `<pre data-type="frontmatter" data-language="yaml"><code>${content}</code></pre>`;
            };
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
      "Mod-Alt-f": () => this.editor.commands.insertContent("---\n\n---"),
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
