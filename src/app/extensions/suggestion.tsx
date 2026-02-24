import { css } from "@g4rcez/components";
import { computePosition, flip, shift } from "@floating-ui/dom";
import { posToDOMRect, ReactRenderer } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Note } from "@/store/note";

const MentionList = forwardRef((props: any, ref: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.id, label: item.label, path: item.path });
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length,
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <ul className="flex relative flex-col p-1 rounded-xl shadow-xl border-floating-border bg-floating-background">
      {props.items.length ? (
        props.items.map(
          (
            item: { id: string; label: string; path: string },
            index: number,
          ) => (
            <li key={item.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(index)}
                className={css(
                  "items-center flex gap-2 w-full text-left p-1 px-2 rounded",
                  index === selectedIndex
                    ? "bg-primary text-primary-foreground"
                    : "",
                )}
              >
                {item.label}
              </button>
            </li>
          ),
        )
      ) : (
        <li className="flex p-1 px-2 w-full text-left rounded">No result</li>
      )}
    </ul>
  );
});

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
    let reactRenderer;
    return {
      onStart: (props) => {
        if (!props.clientRect) {
          return;
        }
        reactRenderer = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });
        reactRenderer.element.style.position = "absolute";
        document.body.appendChild(reactRenderer.element);
        updatePosition(props.editor, reactRenderer.element);
      },
      onUpdate(props: any) {
        reactRenderer.updateProps(props);
        if (!props.clientRect) {
          return;
        }
        updatePosition(props.editor, reactRenderer.element);
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          reactRenderer.destroy();
          reactRenderer.element.remove();
          return true;
        }
        return reactRenderer.ref?.onKeyDown(props);
      },
      onExit() {
        reactRenderer.destroy();
        reactRenderer.element.remove();
      },
    };
  },
};
