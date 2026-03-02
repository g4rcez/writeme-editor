import { innerUrl } from "@/lib/encoding";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { Note } from "@/store/note";
import { globalState } from "@/store/global.store";
import { computePosition, flip, shift } from "@floating-ui/dom";
import { posToDOMRect, ReactRenderer } from "@tiptap/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const MentionList = (props: any) => {
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
    const item = itemsRef.current[index];
    if (!item) return;
    const { from, to } = rangeRef.current;
    editorRef.current
      .chain()
      .focus()
      .command(({ tr, state }: { tr: any; state: any }) => {
        const node = state.schema.nodes.mention.create({
          id: item.id,
          label: item.label,
          path: item.path,
        });
        tr.replaceWith(from, to, node);
        return true;
      })
      .run();
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useEffect(() => {
    listRef.current?.children[selectedIndex]?.scrollIntoView({
      block: "nearest",
    });
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

  const storageDir = useMemo(() => {
    return globalState().directory || "";
  }, []);

  return (
    <ul
      ref={listRef}
      className="flex overflow-y-auto relative flex-col p-1 w-80 max-h-64 rounded-lg border shadow-lg border-border bg-background z-50 animate-fade-in-scale"
    >
      {props.items.length ? (
        props.items.map((item: any, index: number) => {
          const relativePath =
            item.filePath && storageDir
              ? getRelativePath(storageDir, item.filePath)
              : "";
          const folderPath = relativePath.includes("/")
            ? relativePath.substring(0, relativePath.lastIndexOf("/"))
            : "";
          const displayPath = formatSimplifiedPath(folderPath);

          return (
            <li key={item.id}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(index);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex flex-col px-3 py-2 rounded-md w-full text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <span className="text-sm font-medium truncate">
                  {item.label || "Untitled"}
                </span>
                {displayPath && (
                  <span className="text-xs text-foreground/50 truncate">
                    {displayPath}
                  </span>
                )}
              </button>
            </li>
          );
        })
      ) : (
        <li className="p-4 text-center text-sm text-foreground/50">
          No notes found
        </li>
      )}
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

export const suggestion = {
  items: async ({ query, editor }: { query: string; editor: any }) => {
    try {
      const notes: Note[] = (editor.storage as any).allNotes ?? [];
      return notes
        .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
        .map((n) => ({
          id: n.id,
          label: n.title,
          path: n.filePath || innerUrl(`/note/${n.id}`, "mention"),
          filePath: n.filePath,
        }));
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
        if (!props.clientRect) {
          return;
        }
        reactRenderer = new ReactRenderer(MentionList, {
          props: { ...props, registerKeyDown },
          editor: props.editor,
        });
        reactRenderer.element.style.position = "absolute";
        document.body.appendChild(reactRenderer.element);
        updatePosition(props.editor, reactRenderer.element);
      },
      onUpdate(props: any) {
        reactRenderer?.updateProps({ ...props, registerKeyDown });
        if (!props.clientRect) {
          return;
        }
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
