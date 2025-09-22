import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useState } from "react";

export const ExcalidrawCode = (props: {
  code: string;
  onChange?: (s: string) => void;
}) => {
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
      {/* <Excalidraw */}
      {/*   theme="light" */}
      {/*   gridModeEnabled */}
      {/*   autoFocus={false} */}
      {/*   initialData={state} */}
      {/*   isCollaborating={false} */}
      {/*   onChange={(elements) => { */}
      {/*     if (elements.length === 0) return; */}
      {/*     props.onChange?.(JSON.stringify(elements)); */}
      {/*   }} */}
      {/* /> */}
    </div>
  );
};
