import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export const SuggestionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.id, label: item.title });
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length
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
    onKeyDown: (x: any) => {
      if (x.event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (x.event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (x.event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden min-w-[200px] flex flex-col">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`px-4 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item.title}
          </button>
        ))
      ) : (
        <div className="px-4 py-2 text-sm text-gray-500">No results</div>
      )}
    </div>
  );
});

SuggestionList.displayName = "SuggestionList";
