import {
  ArrowRightIcon,
  CodeBlockIcon,
  ColumnsIcon,
  ListBulletsIcon,
  ListChecksIcon,
  ListNumbersIcon,
  MathOperationsIcon,
  MinusIcon,
  QuotesIcon,
  TableIcon,
  TextHOneIcon,
  TextHThreeIcon,
  TextHTwoIcon,
} from "@phosphor-icons/react";
import { Button, Input, Modal } from "@g4rcez/components";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { updatePosition } from "@/app/extensions/update-position";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type SlashCommandItem = {
  label: string;
  description: string;
  icon: React.ElementType;
  group: string;
  needsModal?: "table" | "math";
  command: (editor: any, range: any) => void;
};

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    label: "Heading 1",
    description: "Large section heading",
    icon: TextHOneIcon,
    group: "Headings",
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 1 })
        .run(),
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    icon: TextHTwoIcon,
    group: "Headings",
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 2 })
        .run(),
  },
  {
    label: "Heading 3",
    description: "Small section heading",
    icon: TextHThreeIcon,
    group: "Headings",
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 3 })
        .run(),
  },
  {
    label: "Bullet List",
    description: "Create an unordered list",
    icon: ListBulletsIcon,
    group: "Lists",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    label: "Ordered List",
    description: "Create a numbered list",
    icon: ListNumbersIcon,
    group: "Lists",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    label: "Task List",
    description: "Track tasks with checkboxes",
    icon: ListChecksIcon,
    group: "Lists",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    label: "Blockquote",
    description: "Capture a quote",
    icon: QuotesIcon,
    group: "Blocks",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    label: "Callout",
    description: "Highlight important information",
    icon: ArrowRightIcon,
    group: "Blocks",
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
    icon: CodeBlockIcon,
    group: "Blocks",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    label: "Table",
    description: "Insert a table",
    icon: TableIcon,
    group: "Inserts",
    needsModal: "table",
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
    icon: MinusIcon,
    group: "Inserts",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    label: "Frontmatter",
    description: "Add YAML frontmatter",
    icon: ColumnsIcon,
    group: "Inserts",
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
    icon: MathOperationsIcon,
    group: "Inserts",
    needsModal: "math",
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "inlineMath", attrs: { latex: "" } })
        .run(),
  },
];

const TableInsertModal = ({
  editor,
  onClose,
}: {
  editor: any;
  onClose: () => void;
}) => {
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");
  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    editor
      .chain()
      .focus()
      .insertTable({
        rows: parseInt(rows) || 3,
        cols: parseInt(cols) || 3,
        withHeaderRow: true,
      })
      .run();
    onClose();
  };
  return (
    <Modal open onChange={onClose} title="Insert Table" className="max-w-xs">
      <form onSubmit={confirm} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex flex-col flex-1 gap-1">
            <label className="text-xs font-medium opacity-60">Rows</label>
            <Input
              type="number"
              min="1"
              value={rows}
              onChange={(e) => setRows(e.target.value)}
            />
          </div>
          <div className="flex flex-col flex-1 gap-1">
            <label className="text-xs font-medium opacity-60">Columns</label>
            <Input
              type="number"
              min="1"
              value={cols}
              onChange={(e) => setCols(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Insert</Button>
        </div>
      </form>
    </Modal>
  );
};

const MathInsertModal = ({
  editor,
  onClose,
}: {
  editor: any;
  onClose: () => void;
}) => {
  const [mathExpr, setMathExpr] = useState("");
  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    editor
      .chain()
      .focus()
      .insertContent({ type: "inlineMath", attrs: { latex: mathExpr } })
      .run();
    onClose();
  };
  const handleClose = () => {
    setMathExpr("");
    onClose();
  };
  return (
    <Modal
      open
      onChange={handleClose}
      title="Insert Math Expression"
      className="max-w-sm"
    >
      <form onSubmit={confirm} className="flex flex-col gap-4">
        <Input
          value={mathExpr}
          onChange={(e) => setMathExpr(e.target.value)}
          placeholder="\frac{1}{2}"
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Insert</Button>
        </div>
      </form>
    </Modal>
  );
};

const openSlashModal = (type: "table" | "math", editor: any) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const close = () => {
    root.unmount();
    container.remove();
  };
  root.render(
    type === "table" ? (
      <TableInsertModal editor={editor} onClose={close} />
    ) : (
      <MathInsertModal editor={editor} onClose={close} />
    ),
  );
};

const SlashList = (props: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

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
    if (item.needsModal) {
      editorRef.current.chain().focus().deleteRange(rangeRef.current).run();
      openSlashModal(item.needsModal, editorRef.current);
      return;
    }
    item.command(editorRef.current, rangeRef.current);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

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

  const grouped = props.items.reduce(
    (
      acc: Record<string, { item: SlashCommandItem; index: number }[]>,
      item: SlashCommandItem,
      index: number,
    ) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group]!.push({ item, index });
      return acc;
    },
    {} as Record<string, { item: SlashCommandItem; index: number }[]>,
  );

  if (!props.items.length) return null;

  return (
    <ul
      ref={listRef}
      className="flex overflow-y-auto relative z-50 flex-col p-1 w-80 max-h-64 rounded-lg border shadow-lg border-border bg-background animate-fade-in-scale"
    >
      {Object.entries(grouped).map(([groupName, entries]) => (
        <Fragment key={groupName}>
          <li className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wider uppercase pointer-events-none select-none text-foreground/50">
            {groupName}
          </li>
          {(entries as { item: SlashCommandItem; index: number }[]).map(
            ({ item, index }) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <li key={item.label} data-index={index}>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectItem(index);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex text-left w-full items-center gap-3 px-3 py-2 rounded-md transition-colors ${isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-foreground"}`}
                  >
                    <span className="flex flex-shrink-0 justify-center items-center w-8 h-8 rounded">
                      <Icon size={16} />
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm font-medium leading-tight">
                        {item.label}
                      </span>
                      <span className="text-xs leading-tight truncate text-foreground/50">
                        {item.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            },
          )}
        </Fragment>
      ))}
    </ul>
  );
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
          item.label?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q),
      );
    } catch {
      return [];
    }
  },
  render: () => {
    let reactRenderer: ReactRenderer | undefined;
    let keyDownHandler: ((props: { event: KeyboardEvent }) => boolean) | null =
      null;
    let currentEditor: any = null;
    let currentRange: any = null;
    let currentItems: any[] = [];
    const registerKeyDown = (
      fn: (props: { event: KeyboardEvent }) => boolean,
    ) => {
      keyDownHandler = fn;
    };
    return {
      onStart: (props: any) => {
        currentEditor = props.editor;
        currentRange = props.range;
        currentItems = props.items ?? [];
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
        currentEditor = props.editor;
        currentRange = props.range;
        currentItems = props.items ?? [];
        reactRenderer?.updateProps({ ...props, registerKeyDown });
        if (!props.clientRect) return;
        updatePosition(props.editor, reactRenderer!.element);
      },
      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          currentEditor?.chain().focus().deleteRange(currentRange).run();
          reactRenderer?.destroy();
          reactRenderer?.element.remove();
          return true;
        }
        if (props.event.key === "Enter" && currentItems.length === 0) {
          currentEditor?.chain().focus().deleteRange(currentRange).run();
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
