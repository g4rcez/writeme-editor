import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import { Button } from "@g4rcez/components";
import { CornersInIcon } from "@phosphor-icons/react/dist/csr/CornersIn";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useGlobalStore } from "@/store/global.store";

const EXCALIDRAW_SAVE_DELAY_MS = 500;

type SignedElement = { id: string; version?: number; versionNonce?: number; isDeleted?: boolean };

/** Cheap identity of a scene: changes whenever an element is added, edited, moved or deleted. */
const sceneSignature = (elements: readonly SignedElement[]): string => {
    let hash = 5381;
    for (const element of elements) {
        const part = `${element.id}:${element.version ?? 0}:${element.versionNonce ?? 0}:${element.isDeleted ? 1 : 0}`;
        for (let index = 0; index < part.length; index++) hash = ((hash * 33) ^ part.charCodeAt(index)) | 0;
    }
    return `${elements.length}:${hash}`;
};

export const ExcalidrawCode = (props: { code: string; autoDelete: () => void; onChange?: (s: string) => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [global] = useGlobalStore((current) => ({ theme: current.theme }));
    const [state, setState] = useState<ComponentProps<typeof Excalidraw>["initialData"] | null>(null);
    const lastElementsRef = useRef(props.code);
    const lastSignatureRef = useRef<string | null>(null);
    const pendingRef = useRef<{ timer: ReturnType<typeof setTimeout>; elements: readonly unknown[] } | null>(null);
    const onChangeRef = useRef(props.onChange);
    onChangeRef.current = props.onChange;

    const flush = useCallback(() => {
        const pending = pendingRef.current;
        if (!pending) return;
        clearTimeout(pending.timer);
        pendingRef.current = null;
        const serialized = JSON.stringify(pending.elements);
        if (serialized === lastElementsRef.current) return;
        lastElementsRef.current = serialized;
        onChangeRef.current?.(serialized);
    }, []);

    // Excalidraw reports pointer and app-state changes as well as edits. A cheap version signature filters those out
    // and the (expensive) serialize + document rewrite runs once the drawing has been quiet for a moment.
    const onChange: NonNullable<ComponentProps<typeof Excalidraw>["onChange"]> = useCallback(
        (elements) => {
            const signature = sceneSignature(elements);
            if (signature === lastSignatureRef.current) return;
            lastSignatureRef.current = signature;
            if (pendingRef.current) clearTimeout(pendingRef.current.timer);
            pendingRef.current = { elements, timer: setTimeout(flush, EXCALIDRAW_SAVE_DELAY_MS) };
        },
        [flush],
    );

    useEffect(() => flush, [flush]);

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
            lastSignatureRef.current = sceneSignature(elements);
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
