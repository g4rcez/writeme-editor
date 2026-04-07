import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useRef, useState } from "react";
import { useGlobalStore } from "@/store/global.store";
import { Button } from "@g4rcez/components";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { CornersInIcon } from "@phosphor-icons/react/dist/csr/CornersIn";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { Editor } from "@tiptap/core";

export const ExcalidrawCode = (props: {
  code: string;
  autoDelete: () => void;
  onChange?: (s: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [global] = useGlobalStore();
  const [state, setState] = useState<any | null>(null);

  const onRequestFullScreen = async () => {
    const div = ref.current;
    if (!div) return;
    if (isFullScreen) {
      await document.exitFullscreen();
      return setIsFullScreen(false);
    }
    await div.requestFullscreen();
    setIsFullScreen(true);
  };

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
  const Icon = isFullScreen ? CornersInIcon : CornersOutIcon;
  return (
    <div ref={ref} className="relative p-6 w-full min-w-full bg-card h-[800px]">
      <Excalidraw
        gridModeEnabled
        initialData={state}
        theme={global.theme}
        isCollaborating={false}
        onChange={(elements: any) => {
          if (elements.length === 0) return;
          props.onChange?.(JSON.stringify(elements));
        }}
      />
      <div className="flex absolute top-0 right-0 gap-2 bg-card items-center z-navbar">
        <Button
          size="small"
          theme="ghost-primary"
          onClick={onRequestFullScreen}
        >
          <Icon size={16} />
        </Button>
        <Button size="small" theme="ghost-danger" onClick={props.autoDelete}>
          <TrashIcon size={16} />
        </Button>
      </div>
    </div>
  );
};
