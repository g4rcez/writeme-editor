import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import { Button } from "@g4rcez/components";
import { CornersInIcon } from "@phosphor-icons/react/dist/csr/CornersIn";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useGlobalStore } from "@/store/global.store";

export const ExcalidrawCode = (props: { code: string; autoDelete: () => void; onChange?: (s: string) => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [global] = useGlobalStore();
    const [state, setState] = useState<ComponentProps<typeof Excalidraw>["initialData"] | null>(null);
    const lastElementsRef = useRef(props.code);
    const onChangeRef = useRef(props.onChange);
    useEffect(() => {
        onChangeRef.current = props.onChange;
    }, [props.onChange]);

    const onChange: NonNullable<ComponentProps<typeof Excalidraw>["onChange"]> = useCallback((elements) => {
        const serialized = JSON.stringify(elements);
        if (serialized === lastElementsRef.current) return;
        lastElementsRef.current = serialized;
        onChangeRef.current?.(serialized);
    }, []);

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
            const data = JSON.parse(props.code) as Parameters<typeof restoreElements>[0];
            const elements = restoreElements(data, null);
            lastElementsRef.current = JSON.stringify(elements);
            setState({ elements });
        } catch (e) {
            console.error(e);
            setState({ elements: [] });
        }
    }, []);

    if (state === null) return null;
    const Icon = isFullScreen ? CornersInIcon : CornersOutIcon;
    return (
        <div ref={ref} className="relative h-[800px] w-full min-w-full bg-card p-6">
            <Excalidraw
                gridModeEnabled
                initialData={state}
                theme={global.theme === "light" ? "light" : "dark"}
                isCollaborating={false}
                onChange={onChange}
            />
            <div className="absolute top-0 right-0 z-navbar flex items-center gap-2 bg-card">
                <Button
                    size="small"
                    theme="ghost-primary"
                    onClick={onRequestFullScreen}
                    title={isFullScreen ? "Exit full screen" : "Open full screen"}
                    aria-label={isFullScreen ? "Exit Excalidraw full screen" : "Open Excalidraw full screen"}
                >
                    <Icon aria-hidden="true" size={16} />
                </Button>
                <Button
                    size="small"
                    theme="ghost-danger"
                    onClick={props.autoDelete}
                    title="Delete Excalidraw drawing"
                    aria-label="Delete Excalidraw drawing"
                >
                    <TrashIcon aria-hidden="true" size={16} />
                </Button>
            </div>
        </div>
    );
};
