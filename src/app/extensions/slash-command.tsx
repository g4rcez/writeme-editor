import {
  ArrowRight,
  Code,
  CodeBlock,
  Columns,
  ListBullets,
  ListChecks,
  ListNumbers,
  MathOperations,
  Minus,
  Quotes,
  Table,
  TextH,
  TextHOne,
  TextHThree,
  TextHTwo,
} from "@phosphor-icons/react";
import { Extension } from "@tiptap/core";
import { ReactRenderer, posToDOMRect } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { computePosition, flip, shift } from "@floating-ui/dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type SlashCommandItem = {
  label: string;
  description: string;
  icon: React.ElementType;
  command: (editor: any, range: any) => void;
};

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    label: "Heading 1",
    description: "Large section heading",
    icon: TextHOne,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    icon: TextHTwo,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    description: "Small section heading",
    icon: TextHThree,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bullet List",
    description: "Create an unordered list",
    icon: ListBullets,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    label: "Ordered List",
    description: "Create a numbered list",
    icon: ListNumbers,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    label: "Task List",
    description: "Track tasks with checkboxes",
    icon: ListChecks,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    label: "Blockquote",
    description: "Capture a quote",
    icon: Quotes,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    label: "Callout",
    description: "Highlight important information",
    icon: ArrowRight,
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "callout", attrs: { type: "info" } })
        .run(),
  },
  {
    label: "Code Block",
    description: "Capture a code snippet",
    icon: CodeBlock,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    label: "Table",
    description: "Insert a table",
    icon: Table,
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    label: "Horizontal Rule",
    description: "Insert a divider",
    icon: Minus,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    label: "Frontmatter",
    description: "Add YAML frontmatter",
    icon: Columns,
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "frontmatter" })
        .run(),
  },
  {
    label: "Inline Math",
    description: "Insert a math expression",
    icon: MathOperations,
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "inlineMath", attrs: { latex: "" } })
        .run(),
  },
];

const SlashList = (props: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const itemsRef = useRef(props.items);
  const editorRef = useRef(props.editor);
  const rangeRef = useRef(props.range);
  const selectedIndexRef = useRef(selectedIndex);

  itemsRef.current = props.items;
  editorRef.current = props.editor;
  rangeRef.current = props.range;
  selectedIndexRef.current = selectedIndex;

  const selectItem = (index: number) => {
    const item: SlashCommandItem = itemsRef.current[index];
    if (!item) return;
    item.command(editorRef.current, rangeRef.current);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useLayoutEffect(() => {
    const handler = ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex(
          (prev) =>
            (prev + itemsRef.current.length - 1) % itemsRef.current.length,
        );
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % itemsRef.current.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndexRef.current);
        return true;
      }
      return false;
    };
    props.registerKeyDown(handler);
  }, []);

  if (!props.items.length) return null;

  return (
    <ul className="flex overflow-y-auto relative flex-col gap-1 p-1 border shadow border-floating-border w-72 max-h-80 bg-floating-background rounded-md">
      {props.items.map((item: SlashCommandItem, index: number) => {
        const Icon = item.icon;
        const isSelected = index === selectedIndex;
        return (
          <li key={item.label}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(index);
              }}
              className={`flex text-left w-full items-center gap-3 px-2 py-1.5 rounded ${isSelected ? "bg-primary text-primary-floating" : "bg-transparent hover:bg-primary/10"}`}
            >
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded border border-current/20">
                <Icon size={16} />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-medium leading-tight">{item.label}</span>
                <span className={`text-xs leading-tight truncate ${isSelected ? "opacity-80" : "opacity-50"}`}>
                  {item.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const updatePosition = (editor: any, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () =>
      posToDOMRect(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
      ),
  };
  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "absolute",
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }) => {
    element.style.width = "max-content";
    element.style.position = strategy;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
};

const slashSuggestion = {
  char: "/",
  startOfLine: false,
  items: ({ query }: { query: string }) => {
    try {
      if (!query) return SLASH_COMMANDS;
      const q = query.toLowerCase();
      return SLASH_COMMANDS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      );
    } catch {
      return [];
    }
  },
  render: () => {
    let reactRenderer: ReactRenderer | undefined;
    let keyDownHandler: ((props: { event: KeyboardEvent }) => boolean) | null =
      null;
    const registerKeyDown = (
      fn: (props: { event: KeyboardEvent }) => boolean,
    ) => {
      keyDownHandler = fn;
    };
    return {
      onStart: (props: any) => {
        if (!props.clientRect) return;
        reactRenderer = new ReactRenderer(SlashList, {
          props: { ...props, registerKeyDown },
          editor: props.editor,
        });
        reactRenderer.element.style.position = "absolute";
        reactRenderer.element.style.zIndex = "50";
        document.body.appendChild(reactRenderer.element);
        updatePosition(props.editor, reactRenderer.element);
      },
      onUpdate(props: any) {
        reactRenderer?.updateProps({ ...props, registerKeyDown });
        if (!props.clientRect) return;
        updatePosition(props.editor, reactRenderer!.element);
      },
      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          reactRenderer?.destroy();
          reactRenderer?.element.remove();
          return true;
        }
        return keyDownHandler?.(props) ?? false;
      },
      onExit() {
        keyDownHandler = null;
        reactRenderer?.destroy();
        reactRenderer?.element.remove();
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...slashSuggestion,
      }),
    ];
  },
});
