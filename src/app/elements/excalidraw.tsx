import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useState } from "react";
import { useGlobalStore } from "../../store/global.store";

export const ExcalidrawCode = (props: {
  code: string;
  onChange?: (s: string) => void;
}) => {
  const [global] = useGlobalStore();
  const [state, setState] = useState<any | null>(null);

  useEffect(() => {
    try {
      const data = JSON.parse(props.code) as any;
      const elements = restoreElements(data, data);
      setState({ elements });
    } catch (e) {
      console.error(e);
      setState({ elements: [] });
    }
  }, []);

  if (state === null) return null;

  return (
    <div className="w-full min-w-full h-[500px]">
      <Excalidraw
        gridModeEnabled
        initialData={state}
        theme={global.theme}
        isCollaborating={false}
        onChange={(elements) => {
          if (elements.length === 0) return;
          props.onChange?.(JSON.stringify(elements));
        }}
      />
    </div>
  );
};
