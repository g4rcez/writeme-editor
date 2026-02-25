import { Note } from "@/store/note";
import { computePosition, flip, shift } from "@floating-ui/dom";
import { posToDOMRect, ReactRenderer } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MentionList = (props: any) => {
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

  return (
    <ul className="flex overflow-y-auto relative flex-col gap-4 p-2 border shadow border-floating-border max-w-72 bg-floating-background">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <li key={item.id}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(index);
              }}
              className={`flex text-left w-full items-center ${index === selectedIndex ? "bg-primary text-primary-floating" : "bg-transparent"}`}
            >
              {item.label}
            </button>
          </li>
        ))
      ) : (
        <li className="item">No result</li>
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
          path: n.filePath || `app://note/${n.id}`,
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
