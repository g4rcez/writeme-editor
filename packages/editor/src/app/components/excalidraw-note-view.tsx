import { Excalidraw, restore, serializeAsJSON } from "@excalidraw/excalidraw";
import { Button } from "@g4rcez/components";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import type { Note } from "@/store/note";
import {
    EMPTY_EXCALIDRAW_PAYLOAD,
    normalizeExcalidrawPayload,
    parseExcalidrawNoteContent,
    replaceExcalidrawNotePayload,
    type ExcalidrawNotePayload,
} from "@/lib/excalidraw-note";
import { useGlobalStore } from "@/store/global.store";

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;

type ParsedState =
    | {
          status: "ready";
          payload: ExcalidrawNotePayload;
          initialData: NonNullable<ExcalidrawProps["initialData"]>;
      }
    | { status: "error"; message: string };

function toInitialData(payload: ExcalidrawNotePayload): ParsedState {
    try {
        const restored = restore(
            {
                elements: payload.elements,
                appState: payload.appState,
                files: payload.files,
            } as Parameters<typeof restore>[0],
            null,
            null,
        );
        return {
            status: "ready",
            payload,
            initialData: restored,
        };
    } catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to restore Excalidraw drawing",
        };
    }
}

export function ExcalidrawNoteView(props: { note: Note }) {
    const [state, dispatch] = useGlobalStore((s) => ({ theme: s.theme }));
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSerializedPayloadRef = useRef<string>("");
    const [resetKey, setResetKey] = useState(0);
    const [localContent, setLocalContent] = useState(props.note.content || "");

    useEffect(() => {
        setLocalContent(props.note.content || "");
        setResetKey((key) => key + 1);
    }, [props.note.id]);

    const parsed = useMemo<ParsedState>(() => {
        try {
            const { payload } = parseExcalidrawNoteContent(localContent);
            lastSerializedPayloadRef.current = JSON.stringify(payload);
            return toInitialData(payload);
        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Failed to parse Excalidraw note JSON",
            };
        }
    }, [localContent]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
        };
    }, [props.note.id]);

    const onChange: NonNullable<ExcalidrawProps["onChange"]> = useCallback(
        (elements, appState, files) => {
            if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                const serializablePayload = normalizeExcalidrawPayload(
                    JSON.parse(serializeAsJSON(elements, appState, files, "local")),
                );
                serializablePayload.appState = {
                    ...serializablePayload.appState,
                    scrollX: appState.scrollX,
                    scrollY: appState.scrollY,
                    zoom: appState.zoom,
                };
                const serializedPayload = JSON.stringify(serializablePayload);
                if (serializedPayload === lastSerializedPayloadRef.current) return;
                lastSerializedPayloadRef.current = serializedPayload;
                const nextContent = replaceExcalidrawNotePayload(localContent, serializablePayload);
                void dispatch.updateNoteContent(props.note.id, nextContent);
            }, 500);
        },
        [dispatch, props.note.id, localContent],
    );

    const resetDrawing = () => {
        if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
        const nextContent = replaceExcalidrawNotePayload(localContent, EMPTY_EXCALIDRAW_PAYLOAD);
        lastSerializedPayloadRef.current = JSON.stringify(EMPTY_EXCALIDRAW_PAYLOAD);
        setLocalContent(nextContent);
        void dispatch.updateNoteContent(props.note.id, nextContent);
        setResetKey((key) => key + 1);
    };

    if (parsed.status === "error") {
        return (
            <div className="flex h-full min-h-0 w-full items-center justify-center bg-background p-6">
                <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card-background p-6 text-center shadow-sm">
                    <WarningCircleIcon size={32} aria-hidden="true" className="text-destructive" />
                    <div className="space-y-2">
                        <h1 className="text-lg font-semibold text-foreground">Excalidraw JSON could not be loaded</h1>
                        <p className="text-sm text-muted-foreground">{parsed.message}</p>
                    </div>
                    <Button theme="danger" onClick={resetDrawing}>
                        Reset to empty drawing
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 w-full bg-background">
            <Excalidraw
                autoFocus
                detectScroll
                gridModeEnabled
                onChange={onChange}
                isCollaborating={false}
                initialData={parsed.initialData}
                key={`${props.note.id}-${resetKey}`}
                theme={state.theme === "light" ? "light" : "dark"}
            />
        </div>
    );
}
