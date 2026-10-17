import { Button } from "@g4rcez/components";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { EraserIcon } from "@phosphor-icons/react/dist/csr/Eraser";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { HighlighterIcon } from "@phosphor-icons/react/dist/csr/Highlighter";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { PaintBrushIcon } from "@phosphor-icons/react/dist/csr/PaintBrush";
import { PenIcon } from "@phosphor-icons/react/dist/csr/Pen";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PenNibIcon } from "@phosphor-icons/react/dist/csr/PenNib";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import clsx from "clsx";
import {
    memo,
    useEffect,
    useEffectEvent,
    useId,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type FocusEvent,
    type JSX,
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
} from "react";
import { v7 as uuid } from "uuid";
import { inkStrokePath, pencilOpacity } from "@/lib/freehand-ink";
import {
    DEFAULT_PAPER_APPEARANCE,
    PAPER_HEIGHT,
    PAPER_WIDTH,
    strokeIntersects,
    type FreehandNotebook,
    type FreehandNoteLink,
    type InkPoint,
    type InkStroke,
    type PaperStyle,
    type PaperAppearance,
    type PenStyle,
} from "@/lib/freehand-note";
import { clampLinkPosition, NoteLinkPicker, StickyNoteLink, type NoteLinkTarget } from "./freehand-note-links";
import { usePdfPageGestures } from "./use-pdf-page-gestures";

type Tool = "pen" | "highlighter" | "eraser" | "hand";
type Drawing = {
    pointerId: number;
    pointerType: string;
    stroke: InkStroke;
    before: FreehandNotebook;
    erased: InkStroke[];
};

type Touch = { x: number; y: number };

const ZOOM_STEP = 0.15;

const INKS = [
    { color: "#243047", label: "Graphite" },
    { color: "#2459c4", label: "Blue" },
    { color: "#be3545", label: "Red" },
    { color: "#267252", label: "Green" },
    { color: "#ffffff", label: "White" },
];
const tools = [
    { tool: "pen", label: "Pen", icon: PencilSimpleIcon },
    { tool: "highlighter", label: "Highlighter", icon: HighlighterIcon },
    { tool: "eraser", label: "Eraser", icon: EraserIcon },
    { tool: "hand", label: "Move page", icon: HandIcon },
] satisfies Array<{ tool: Tool; label: string; icon: typeof PencilSimpleIcon }>;
const penTypes = [
    {
        style: "fountain",
        label: "Fountain pen",
        name: "Fountain",
        description: "Pressure-sensitive ink for everyday writing.",
        icon: PenNibIcon,
    },
    {
        style: "ball",
        label: "Ball pen",
        name: "Ball",
        description: "Consistent line width at any pressure.",
        icon: PenIcon,
    },
    {
        style: "brush",
        label: "Brush pen",
        name: "Brush",
        description: "Expressive pressure and tapered ends for lettering.",
        icon: PaintBrushIcon,
    },
    {
        style: "pencil",
        label: "Pencil",
        name: "Pencil",
        description: "Textured graphite with pressure-sensitive shading.",
        icon: PencilSimpleIcon,
    },
] satisfies Array<{ style: PenStyle; label: string; name: string; description: string; icon: typeof PenIcon }>;
const penPreviewPoints: InkPoint[] = Array.from({ length: 12 }, (_, index) => [
    12 + index * 12,
    22 + Math.sin(index * 0.6) * 10,
    0.1 + (index / 11) * 0.8,
]);

function PaperColor({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (color: string) => void;
}): JSX.Element {
    const [draft, setDraft] = useState(value);
    const [invalid, setInvalid] = useState(false);
    const [previousValue, setPreviousValue] = useState(value);
    const errorId = useId();
    if (value !== previousValue) {
        setPreviousValue(value);
        setDraft(value);
        setInvalid(false);
    }
    function accept(color: string): void {
        setDraft(color);
        setInvalid(false);
        if (color.toLowerCase() !== value.toLowerCase()) onChange(color.toLowerCase());
    }
    function updateFromColorPicker(event: ChangeEvent<HTMLInputElement>): void {
        accept(event.target.value);
    }

    function updateColorDraft(event: ChangeEvent<HTMLInputElement>): void {
        setDraft(event.target.value);
        setInvalid(false);
    }

    function commitColorDraft(): void {
        const color = draft.trim();
        if (/^#[\da-f]{6}$/i.test(color)) accept(color);
        else setInvalid(true);
    }

    function handleColorKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key === "Enter") event.currentTarget.blur();
    }
    return (
        <div className="wm-paper-color">
            <span>{label}</span>
            <div className="wm-paper-color-inputs">
                <input
                    type="color"
                    aria-label={`Choose ${label.toLowerCase()}`}
                    value={value}
                    onChange={updateFromColorPicker}
                />
                <input
                    type="text"
                    aria-label={`${label} hex`}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? errorId : undefined}
                    value={draft}
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={7}
                    onChange={updateColorDraft}
                    onBlur={commitColorDraft}
                    onKeyDown={handleColorKeyDown}
                />
            </div>
            {invalid && (
                <span id={errorId} role="alert">
                    Use a hex color, such as #ffffff.
                </span>
            )}
        </div>
    );
}

const StrokePath = memo(function StrokePath({
    stroke,
    sample = false,
}: {
    stroke: InkStroke;
    sample?: boolean;
}): JSX.Element {
    const textureId = useId().replace(/:/g, "");
    const pencil = stroke.tool === "pen" && stroke.penStyle === "pencil";
    return (
        <>
            {pencil && (
                <defs>
                    <pattern id={textureId} width={4} height={4} patternUnits="userSpaceOnUse">
                        <rect width={4} height={4} fill={stroke.color} opacity={0.45} />
                        <path d="M0 0h1v1H0z M2 1h1v1H2z M1 3h1v1H1z M3 3h1v1H3z" fill={stroke.color} />
                    </pattern>
                </defs>
            )}
            <path
                d={inkStrokePath(stroke)}
                fill={pencil ? `url(#${textureId})` : stroke.color}
                opacity={stroke.tool === "highlighter" ? 0.35 : pencil ? pencilOpacity(stroke) : 1}
                data-ink-stroke={sample ? undefined : stroke.tool}
                data-pen-style={sample ? undefined : stroke.penStyle}
            />
        </>
    );
});

export function FreehandCanvas({
    initialData,
    onChange,
    saveStatus,
    onRetry,
    actions,
    linkableNotes,
    selectionAction,
    initialPageIndex = 0,
    pageBackground,
    fixedPages = false,
    title,
}: {
    initialData: FreehandNotebook;
    onChange: (data: FreehandNotebook) => void;
    saveStatus: "Saved" | "Saving…" | "Could not save";
    onRetry: () => void;
    actions?: ReactNode;
    linkableNotes: readonly NoteLinkTarget[];
    selectionAction?: ReactNode;
    initialPageIndex?: number;
    pageBackground?: (pageIndex: number, zoom: number) => ReactNode;
    fixedPages?: boolean;
    title?: string;
}): JSX.Element {
    const [notebook, setNotebook] = useState(initialData);
    const notebookRef = useRef(notebook);
    const [pageIndex, setPageIndex] = useState(() =>
        Math.max(0, Math.min(initialData.pages.length - 1, initialPageIndex)),
    );
    const [pageAnchor, setPageAnchor] = useState(initialPageIndex);
    if (pageAnchor !== initialPageIndex) {
        setPageAnchor(initialPageIndex);
        setPageIndex(Math.max(0, Math.min(initialData.pages.length - 1, initialPageIndex)));
    }
    const [tool, setTool] = useState<Tool>(fixedPages ? "hand" : "pen");
    const [penStyle, setPenStyle] = useState<PenStyle>("fountain");
    const [ink, setInk] = useState(INKS[0]!.color);
    const [size, setSize] = useState(4);
    const [drawWithTouch, setDrawWithTouch] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [toolsHidden, setToolsHidden] = useState(false);
    const [activePanel, setActivePanel] = useState<"pen" | "ink" | "notebook" | "link" | null>(null);
    const [placingLinkId, setPlacingLinkId] = useState<string | null>(null);
    const paper = useRef<SVGSVGElement>(null);
    const inkOptionsButton = useRef<HTMLButtonElement>(null);
    const penOptionsButton = useRef<HTMLButtonElement>(null);
    const notebookOptionsButton = useRef<HTMLButtonElement>(null);
    const optionsPanel = useRef<HTMLDialogElement>(null);
    const showToolsButton = useRef<HTMLButtonElement>(null);
    const previouslyHidden = useRef(false);
    const zoomRef = useRef(zoom);
    const zoomOptions = useRef<HTMLFieldSetElement>(null);
    const zoomReset = useRef<HTMLButtonElement>(null);
    const [preview, setPreview] = useState<InkStroke | null>(null);
    const drawing = useRef<Drawing | null>(null);
    const touches = useRef(new Map<number, Touch>());
    const moving = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const viewport = useRef<HTMLDivElement>(null);
    const undo = useRef<FreehandNotebook[]>([]);
    const redo = useRef<FreehandNotebook[]>([]);
    const patternId = useId().replace(/:/g, "");
    const panelId = useId();
    const penDescriptionId = useId();
    const page = notebook.pages[pageIndex]!;
    const pageHeight = page.height ?? PAPER_HEIGHT;
    const appearance = notebook.appearance ?? DEFAULT_PAPER_APPEARANCE;
    const selectedPen = penTypes.find((pen) => pen.style === penStyle)!;
    const readingPdf = fixedPages && tool === "hand" && !placingLinkId;
    const pdfGestures = usePdfPageGestures({
        enabled: readingPdf,
        pageIndex,
        zoom,
        onZoom: changeZoom,
        onTurn: (direction) => {
            cancelDrawing();
            setPageIndex((index) => Math.max(0, Math.min(notebook.pages.length - 1, index + direction)));
            viewport.current?.scrollTo(0, 0);
        },
    });

    const zoomWithWheel = useEffectEvent((event: WheelEvent): void => {
        if (event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        changeZoom(zoomRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    });

    useEffect(() => {
        const controls: (HTMLElement | null)[] = [zoomOptions.current, zoomReset.current];
        for (const control of controls) control?.addEventListener("wheel", zoomWithWheel, { passive: false });
        return () => {
            for (const control of controls) control?.removeEventListener("wheel", zoomWithWheel);
        };
    }, [activePanel, toolsHidden]);

    useEffect(() => {
        const paperViewport = viewport.current;
        if (!paperViewport) return;

        let previousSize: { width: number; height: number } | null = null;
        const observer = new ResizeObserver(() => {
            const { width, height } = paperViewport.getBoundingClientRect();
            if (!previousSize) {
                previousSize = { width, height };
                return;
            }
            if (previousSize.width === width && previousSize.height === height) return;
            previousSize = { width, height };
            if (!window.matchMedia("(max-width: 900px)").matches) return;

            const card = paperViewport.querySelector<HTMLElement>(".wm-sticky-link");
            if (!card) return;
            const viewportBounds = paperViewport.getBoundingClientRect();
            const cardBounds = card.getBoundingClientRect();
            const visibleTop = Math.max(0, viewportBounds.top);
            const bottomToolbar = paperViewport
                .closest<HTMLElement>(".wm-notebook")
                ?.querySelector<HTMLElement>(".wm-notebook-bottom")
                ?.getBoundingClientRect();
            const toolbarOverlapsViewport =
                bottomToolbar !== undefined &&
                bottomToolbar.top < viewportBounds.bottom &&
                bottomToolbar.bottom > viewportBounds.top;
            const visibleBottom = Math.min(
                document.documentElement.clientHeight,
                viewportBounds.bottom,
                toolbarOverlapsViewport ? bottomToolbar.top : Infinity,
            );
            if (cardBounds.bottom > visibleBottom) {
                paperViewport.scrollTop += cardBounds.bottom - visibleBottom;
            } else if (cardBounds.top < visibleTop) {
                paperViewport.scrollTop -= visibleTop - cardBounds.top;
            }
        });
        observer.observe(paperViewport);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (toolsHidden) showToolsButton.current?.focus();
        else if (previouslyHidden.current) notebookOptionsButton.current?.focus();
        previouslyHidden.current = toolsHidden;
    }, [toolsHidden]);

    useEffect(() => {
        if (!activePanel) return;
        const trigger =
            activePanel === "pen" ? penOptionsButton : activePanel === "ink" ? inkOptionsButton : notebookOptionsButton;
        optionsPanel.current?.querySelector<HTMLElement>("input[type='search'], select, button[aria-pressed]")?.focus();
        const dismissOutside = (event: Event): void => {
            if (!(event.target instanceof Node)) return;
            if (optionsPanel.current?.contains(event.target) || trigger.current?.contains(event.target)) return;
            setActivePanel(null);
        };
        const dismissWithEscape = (event: globalThis.KeyboardEvent): void => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setActivePanel(null);
            trigger.current?.focus();
        };
        document.addEventListener("pointerdown", dismissOutside);
        document.addEventListener("focusin", dismissOutside);
        document.addEventListener("keydown", dismissWithEscape);
        return () => {
            document.removeEventListener("pointerdown", dismissOutside);
            document.removeEventListener("focusin", dismissOutside);
            document.removeEventListener("keydown", dismissWithEscape);
        };
    }, [activePanel]);

    useEffect(() => {
        if (!placingLinkId) return;
        const cancelPlacement = (event: globalThis.KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.preventDefault();
                setPlacingLinkId(null);
            }
        };
        document.addEventListener("keydown", cancelPlacement);
        return () => document.removeEventListener("keydown", cancelPlacement);
    }, [placingLinkId]);

    function closeOptions(): void {
        (activePanel === "pen"
            ? penOptionsButton
            : activePanel === "ink"
              ? inkOptionsButton
              : notebookOptionsButton
        ).current?.focus();
        setActivePanel(null);
    }

    function show(next: FreehandNotebook): void {
        notebookRef.current = next;
        setNotebook(next);
    }

    function commit(next: FreehandNotebook, before = notebookRef.current): void {
        undo.current = [...undo.current.slice(-49), before];
        redo.current = [];
        show(next);
        onChange(next);
    }

    function withStrokes(strokes: InkStroke[], base = notebookRef.current): FreehandNotebook {
        return { ...base, pages: base.pages.map((page, index) => (index === pageIndex ? { ...page, strokes } : page)) };
    }

    function updateLinks(links: FreehandNoteLink[]): void {
        cancelDrawing();
        const base = notebookRef.current;
        commit({ ...base, pages: base.pages.map((page, index) => (index === pageIndex ? { ...page, links } : page)) });
        setPlacingLinkId(null);
    }

    function updateAppearance(changes: Partial<PaperAppearance>): void {
        cancelDrawing();
        const base = notebookRef.current;
        commit({ ...base, appearance: { ...(base.appearance ?? DEFAULT_PAPER_APPEARANCE), ...changes } });
    }

    function moveLink(id: string, position: Pick<FreehandNoteLink, "x" | "y">): void {
        updateLinks(
            (notebookRef.current.pages[pageIndex]!.links ?? []).map((link) =>
                link.id === id
                    ? {
                          ...link,
                          ...clampLinkPosition(position, paper.current?.getBoundingClientRect().width, pageHeight),
                      }
                    : link,
            ),
        );
    }

    function addLink(note: NoteLinkTarget): void {
        const scale = (paper.current?.getBoundingClientRect().width ?? PAPER_WIDTH) / PAPER_WIDTH;
        const offset = ((notebookRef.current.pages[pageIndex]!.links?.length ?? 0) % 4) * 24;
        const position = clampLinkPosition(
            {
                x:
                    ((viewport.current?.scrollLeft ?? 0) +
                        Math.max(12, ((viewport.current?.clientWidth ?? 1000) - 208) / 2) +
                        offset) /
                    scale,
                y:
                    ((viewport.current?.scrollTop ?? 0) +
                        Math.max(80, ((viewport.current?.clientHeight ?? 600) - 112) / 2) +
                        offset) /
                    scale,
            },
            paper.current?.getBoundingClientRect().width,
            pageHeight,
        );
        updateLinks([
            ...(notebookRef.current.pages[pageIndex]!.links ?? []),
            { id: uuid(), noteId: note.id, title: note.title, ...position },
        ]);
        closeOptions();
    }

    function changeZoom(value: number): void {
        const next = Math.min(3, Math.max(0.5, value));
        zoomRef.current = next;
        setZoom(next);
    }

    function resetZoom(): void {
        changeZoom(1);
        viewport.current?.scrollTo(0, 0);
    }

    function pointFromEvent(event: globalThis.PointerEvent, surface: SVGSVGElement): InkPoint {
        const matrix = surface.getScreenCTM();
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix?.inverse());
        return [point.x, point.y, event.pointerType === "pen" ? event.pressure : 0.5];
    }

    function cancelDrawing(): void {
        if (drawing.current) show(drawing.current.before);
        drawing.current = null;
        setPreview(null);
    }

    function pointerDown(event: PointerEvent<SVGSVGElement>): void {
        if (event.button !== 0 || (event.pointerType === "touch" && (event.width > 40 || event.height > 40))) return;
        if (placingLinkId) {
            event.preventDefault();
            const [x, y] = pointFromEvent(event.nativeEvent, event.currentTarget);
            moveLink(placingLinkId, { x, y });
            return;
        }
        if (drawing.current?.pointerType === "pen" || drawing.current?.pointerType === "mouse") return;
        if (drawing.current && event.pointerType === "pen") cancelDrawing();
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.pointerType === "touch") {
            touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (touches.current.size > 1) {
                cancelDrawing();
                return;
            }
        }
        if (tool === "hand" || (event.pointerType === "touch" && !drawWithTouch)) {
            moving.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            return;
        }
        if (drawing.current) return;
        if (event.pointerType !== "touch") touches.current.clear();
        moving.current = null;
        const stroke: InkStroke = {
            points: [pointFromEvent(event.nativeEvent, event.currentTarget)],
            color: tool === "highlighter" ? "#f3cf46" : ink,
            size: tool === "highlighter" ? size * 5 : size,
            tool: tool === "highlighter" ? "highlighter" : "pen",
            simulatePressure: event.pointerType !== "pen",
            ...(tool === "pen" ? { penStyle } : {}),
        };
        drawing.current = {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            stroke,
            before: notebookRef.current,
            erased: page.strokes,
        };
        if (tool === "eraser") erase(stroke.points[0]!, stroke.points[0]!);
        else setPreview({ ...stroke });
    }

    function erase(from: InkPoint, to: InkPoint): void {
        const active = drawing.current;
        if (!active) return;
        active.erased = active.erased.filter((stroke) => !strokeIntersects(stroke, from, to, 14));
        show(withStrokes(active.erased));
    }

    function pointerMove(event: PointerEvent<SVGSVGElement>): void {
        const touch = touches.current.get(event.pointerId);
        if (touch && !drawing.current) {
            const previous = [...touches.current.values()];
            touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const next = [...touches.current.values()];
            if (previous.length === 2 && next.length === 2) {
                const oldDistance = Math.hypot(previous[0]!.x - previous[1]!.x, previous[0]!.y - previous[1]!.y);
                const newDistance = Math.hypot(next[0]!.x - next[1]!.x, next[0]!.y - next[1]!.y);
                if (oldDistance > 0) changeZoom((zoomRef.current * newDistance) / oldDistance);
            }
        }
        const active = drawing.current;
        if (active?.pointerId === event.pointerId) {
            const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
            for (const sample of events.length ? events : [event.nativeEvent]) {
                const point = pointFromEvent(sample, event.currentTarget);
                const previous = active.stroke.points.at(-1)!;
                active.stroke.points.push(point);
                if (tool === "eraser") erase(previous, point);
            }
            if (tool !== "eraser") setPreview({ ...active.stroke, points: [...active.stroke.points] });
        } else if (moving.current?.pointerId === event.pointerId && viewport.current) {
            viewport.current.scrollLeft -= event.clientX - moving.current.x;
            viewport.current.scrollTop -= event.clientY - moving.current.y;
            moving.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        }
    }

    function pointerEnd(event: PointerEvent<SVGSVGElement>, cancelled = false): void {
        touches.current.delete(event.pointerId);
        if (moving.current?.pointerId === event.pointerId) moving.current = null;
        const active = drawing.current;
        if (active?.pointerId !== event.pointerId) return;
        if (cancelled) {
            cancelDrawing();
            return;
        }
        const finalPoint = pointFromEvent(event.nativeEvent, event.currentTarget);
        finalPoint[2] = active.stroke.points.at(-1)![2];
        if (tool === "eraser") {
            erase(active.stroke.points.at(-1)!, finalPoint);
            if (active.erased.length !== active.before.pages[pageIndex]!.strokes.length)
                commit(withStrokes(active.erased), active.before);
        } else {
            active.stroke.points.push(finalPoint);
            commit(withStrokes([...page.strokes, active.stroke]), active.before);
        }
        drawing.current = null;
        setPreview(null);
    }

    function history(direction: "undo" | "redo"): void {
        cancelDrawing();
        setPlacingLinkId(null);
        const source = direction === "undo" ? undo : redo;
        const destination = direction === "undo" ? redo : undo;
        const next = source.current.pop();
        if (!next) return;
        destination.current.push(notebookRef.current);
        setPageIndex((index) => Math.min(index, next.pages.length - 1));
        show(next);
        onChange(next);
    }
    function focusNotebookFromPointer(event: PointerEvent<HTMLElement>): void {
        if (event.target instanceof Node && viewport.current?.contains(event.target))
            event.currentTarget.focus({ preventScroll: true });
    }

    function handleNotebookKeyDown(event: KeyboardEvent<HTMLElement>): void {
        if (event.altKey) return;
        if (!(event.metaKey || event.ctrlKey)) {
            if (!fixedPages || event.target !== event.currentTarget) return;
            const direction =
                event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown"
                    ? 1
                    : event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp"
                      ? -1
                      : 0;
            if (!direction) return;
            event.preventDefault();
            cancelDrawing();
            setPageIndex(Math.max(0, Math.min(notebook.pages.length - 1, pageIndex + direction)));
            setPlacingLinkId(null);
            viewport.current?.scrollTo(0, 0);
            return;
        }
        const direction = event.key === "=" || event.key === "+" ? 1 : event.key === "-" ? -1 : 0;
        const reset = event.key === "0";
        if (!direction && !reset) return;
        event.preventDefault();
        event.stopPropagation();
        if (reset) resetZoom();
        else changeZoom(zoomRef.current + direction * ZOOM_STEP);
    }

    function showTools(): void {
        setToolsHidden(false);
    }

    function readPdf(): void {
        cancelDrawing();
        setTool("hand");
        setPlacingLinkId(null);
    }

    function selectDrawingTool(event: MouseEvent<HTMLButtonElement>): void {
        const value = tools.find(({ tool: candidate }) => candidate === event.currentTarget.dataset.tool)?.tool;
        if (!value || value === "hand") return;
        cancelDrawing();
        setActivePanel(value === "pen" && tool === "pen" ? (activePanel === "pen" ? null : "pen") : null);
        setTool(value);
        setPlacingLinkId(null);
    }

    function undoDrawing(): void {
        history("undo");
    }

    function redoDrawing(): void {
        history("redo");
    }

    function toggleInkOptions(): void {
        setActivePanel(activePanel === "ink" ? null : "ink");
    }

    function toggleNotebookOptions(): void {
        setActivePanel(activePanel === "notebook" ? null : "notebook");
    }

    function previousPage(): void {
        cancelDrawing();
        setPageIndex(pageIndex - 1);
        setPlacingLinkId(null);
        viewport.current?.scrollTo(0, 0);
    }

    function nextPage(): void {
        cancelDrawing();
        setPageIndex(pageIndex + 1);
        setPlacingLinkId(null);
        viewport.current?.scrollTo(0, 0);
    }

    function addPage(): void {
        cancelDrawing();
        setPlacingLinkId(null);
        commit({ ...notebook, pages: [...notebook.pages, { strokes: [] }] });
        setPageIndex(notebook.pages.length);
        viewport.current?.scrollTo(0, 0);
    }

    function handlePageNumberKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key === "Enter") event.currentTarget.blur();
    }

    function handlePageNumberBlur(event: FocusEvent<HTMLInputElement>): void {
        const next = event.currentTarget.valueAsNumber;
        if (!Number.isInteger(next) || next < 1 || next > notebook.pages.length) {
            event.currentTarget.value = String(pageIndex + 1);
            return;
        }
        cancelDrawing();
        setPageIndex(next - 1);
        setPlacingLinkId(null);
        viewport.current?.scrollTo(0, 0);
    }

    function pointerCancelled(event: PointerEvent<SVGSVGElement>): void {
        pointerEnd(event, true);
    }

    function cancelLinkPlacement(): void {
        setPlacingLinkId(null);
    }

    function selectPenType(event: MouseEvent<HTMLButtonElement>): void {
        const selected = penTypes.find(({ style }) => style === event.currentTarget.dataset.penStyle);
        if (!selected) return;
        cancelDrawing();
        setPenStyle(selected.style);
        setTool("pen");
        setPlacingLinkId(null);
    }

    function selectInk(event: MouseEvent<HTMLButtonElement>): void {
        const selected = INKS.find(({ color }) => color === event.currentTarget.dataset.inkColor);
        if (!selected) return;
        setInk(selected.color);
        setTool("pen");
        setPlacingLinkId(null);
        closeOptions();
    }

    function resetPaperAppearance(): void {
        updateAppearance(DEFAULT_PAPER_APPEARANCE);
    }

    function zoomOut(): void {
        changeZoom(zoom - ZOOM_STEP);
    }

    function zoomIn(): void {
        changeZoom(zoom + ZOOM_STEP);
    }

    function openLinkPicker(): void {
        setActivePanel("link");
    }

    function movePage(): void {
        cancelDrawing();
        setTool("hand");
        setPlacingLinkId(null);
        closeOptions();
    }

    function hideWritingTools(): void {
        setActivePanel(null);
        setToolsHidden(true);
    }

    function updateStrokeWidth(event: ChangeEvent<HTMLSelectElement>): void {
        setSize(Number(event.target.value));
    }

    function changePaperStyle(event: ChangeEvent<HTMLSelectElement>): void {
        const paper = event.target.value as PaperStyle;
        commit({ ...notebook, paper });
    }

    function updatePaperBackground(background: string): void {
        updateAppearance({ background });
    }

    function updatePatternColor(color: string): void {
        updateAppearance({ color });
    }

    function updatePatternSpacing(event: ChangeEvent<HTMLSelectElement>): void {
        updateAppearance({ spacing: Number(event.target.value) });
    }

    function updatePatternWeight(event: ChangeEvent<HTMLSelectElement>): void {
        updateAppearance({ weight: Number(event.target.value) });
    }

    function updateTouchDrawing(event: ChangeEvent<HTMLInputElement>): void {
        setDrawWithTouch(event.target.checked);
    }

    const drawingToolButtons = tools
        .filter(({ tool: value }) => value !== "hand")
        .map(({ tool: value, label, icon }) => {
            const Icon = value === "pen" ? selectedPen.icon : icon;
            const isPen = value === "pen";
            return (
                <Button
                    theme={tool === value ? "muted" : "ghost-muted"}
                    size="default"
                    ref={isPen ? penOptionsButton : undefined}
                    key={value}
                    type="button"
                    title={isPen ? `${selectedPen.label} · Select again for pen types` : label}
                    aria-label={label}
                    aria-describedby={isPen ? penDescriptionId : undefined}
                    aria-pressed={tool === value}
                    aria-haspopup={isPen ? "dialog" : undefined}
                    aria-expanded={isPen ? activePanel === "pen" : undefined}
                    aria-controls={isPen && activePanel === "pen" ? panelId : undefined}
                    data-tool={value}
                    onClick={selectDrawingTool}
                >
                    <Icon size={20} aria-hidden="true" />
                    {isPen ? (
                        <span className="sr-only" id={penDescriptionId}>
                            {selectedPen.label}. Select Pen again to change pen types.
                        </span>
                    ) : null}
                </Button>
            );
        });
    const penTypeButtons = penTypes.map(({ style, name, label, description, icon: Icon }) => (
        <Button
            theme={penStyle === style ? "muted" : "ghost-muted"}
            size="tiny"
            key={style}
            type="button"
            aria-label={label}
            aria-pressed={penStyle === style}
            title={description}
            data-pen-style={style}
            onClick={selectPenType}
        >
            <Icon size={22} aria-hidden="true" />
            <span>{name}</span>
        </Button>
    ));
    const inkButtons = INKS.map(({ color, label }) => (
        <Button
            theme={ink === color ? "muted" : "ghost-muted"}
            size="tiny"
            key={color}
            type="button"
            aria-label={`${label} ink`}
            aria-pressed={ink === color}
            title={`${label} ink`}
            data-ink-color={color}
            onClick={selectInk}
        >
            <span className="wm-ink-swatch" style={{ backgroundColor: color }} />
        </Button>
    ));

    const optionsPanelLabel =
        activePanel === "pen"
            ? "Pen tools"
            : activePanel === "ink"
              ? "Ink options"
              : activePanel === "link"
                ? "Link a note"
                : "Notebook options";
    const optionsPanelTitle =
        activePanel === "pen"
            ? "Pen type"
            : activePanel === "ink"
              ? "Ink"
              : activePanel === "link"
                ? "Link a note"
                : "Notebook";
    const notebookLabel = fixedPages ? "PDF notebook" : "Handwritten notebook";
    const notebookStyle = {
        "--wm-paper-background": appearance.background,
        "--wm-paper-line": appearance.color,
        "--wm-paper-weight": appearance.weight,
    } as CSSProperties;
    const paperViewportClassName = clsx(
        "wm-paper-viewport",
        fixedPages && "wm-paper-viewport--book",
        readingPdf && "wm-paper-viewport--reading",
    );
    const paperClassName = clsx(
        "wm-paper",
        tool === "hand" && "wm-paper--move",
        fixedPages && "wm-paper--pdf",
        fixedPages && tool === "hand" && !placingLinkId && "wm-paper--reading",
    );
    const paperSpaceStyle: CSSProperties = {
        width: fixedPages
            ? `calc(min(100cqw - 2rem, var(--wm-book-height) * ${PAPER_WIDTH / pageHeight}) * ${zoom})`
            : `max(${zoom * 100}%, calc(100cqh * ${PAPER_WIDTH / pageHeight} * ${zoom}))`,
        transform: pdfGestures.offset ? `translateX(${pdfGestures.offset}px)` : undefined,
    };
    const pageBackgroundElement = pageBackground?.(pageIndex, zoom);
    const strokeElements = page.strokes.map((stroke, index) => <StrokePath key={index} stroke={stroke} />);
    const noteLinkElements = (page.links ?? []).map((link) => {
        function handleMove(position: Pick<FreehandNoteLink, "x" | "y">): void {
            moveLink(link.id, position);
        }

        function handlePlace(): void {
            cancelDrawing();
            setPlacingLinkId(link.id);
            setActivePanel(null);
        }

        function handleRemove(): void {
            updateLinks((page.links ?? []).filter((item) => item.id !== link.id));
            (toolsHidden ? showToolsButton : notebookOptionsButton).current?.focus();
        }

        return (
            <StickyNoteLink
                key={link.id}
                link={link}
                target={linkableNotes.find((note) => note.id === link.noteId)}
                paper={paper}
                placing={placingLinkId === link.id}
                onMove={handleMove}
                onPlace={handlePlace}
                onRemove={handleRemove}
            />
        );
    });
    const linkPlacementNotice = placingLinkId ? (
        <output className="wm-link-placement">
            <span>Tap the paper to move this link.</span>
            <Button theme="ghost-muted" size="tiny" type="button" onClick={cancelLinkPlacement}>
                Cancel
            </Button>
        </output>
    ) : null;
    return (
        <section
            className="wm-notebook"
            tabIndex={-1}
            onPointerDownCapture={focusNotebookFromPointer}
            onKeyDownCapture={handleNotebookKeyDown}
            aria-label={notebookLabel}
            style={notebookStyle}
        >
            {toolsHidden ? (
                <div className="wm-show-tools">
                    <Button
                        theme="ghost-muted"
                        size="default"
                        ref={showToolsButton}
                        type="button"
                        aria-label="Show writing tools"
                        title="Show writing tools"
                        onClick={showTools}
                    >
                        <EyeIcon size={22} aria-hidden="true" />
                    </Button>
                </div>
            ) : (
                <div className="wm-writing-toolbar" role="toolbar" aria-label="Writing tools">
                    {fixedPages ? (
                        <Button
                            theme={tool === "hand" ? "muted" : "ghost-muted"}
                            size="default"
                            type="button"
                            aria-label="Read PDF"
                            aria-pressed={tool === "hand"}
                            onClick={readPdf}
                        >
                            <HandIcon size={20} aria-hidden="true" />
                        </Button>
                    ) : null}
                    {selectionAction}
                    <fieldset className="wm-ink-group" aria-label="Drawing tools">
                        {drawingToolButtons}
                    </fieldset>
                    <fieldset className="wm-ink-group" aria-label="Drawing history">
                        <Button
                            theme="ghost-muted"
                            size="default"
                            type="button"
                            aria-label="Undo drawing"
                            title="Undo"
                            disabled={!undo.current.length}
                            onClick={undoDrawing}
                        >
                            <ArrowCounterClockwiseIcon size={20} aria-hidden="true" />
                        </Button>
                        <Button
                            theme="ghost-muted"
                            size="default"
                            type="button"
                            aria-label="Redo drawing"
                            title="Redo"
                            disabled={!redo.current.length}
                            onClick={redoDrawing}
                        >
                            <ArrowClockwiseIcon size={20} aria-hidden="true" />
                        </Button>
                    </fieldset>
                    <Button
                        theme={activePanel === "ink" ? "muted" : "ghost-muted"}
                        size="default"
                        ref={inkOptionsButton}
                        type="button"
                        aria-label="Ink options"
                        title="Ink color and width"
                        aria-expanded={activePanel === "ink"}
                        aria-controls={activePanel === "ink" ? panelId : undefined}
                        aria-haspopup="dialog"
                        onClick={toggleInkOptions}
                    >
                        <span className="wm-ink-swatch" style={{ backgroundColor: ink }} />
                    </Button>
                    <Button
                        theme={activePanel === "notebook" || activePanel === "link" ? "muted" : "ghost-muted"}
                        size="default"
                        ref={notebookOptionsButton}
                        type="button"
                        aria-label="Notebook options"
                        title="Notebook options"
                        aria-expanded={activePanel === "notebook" || activePanel === "link"}
                        aria-controls={activePanel === "notebook" || activePanel === "link" ? panelId : undefined}
                        aria-haspopup="dialog"
                        onClick={toggleNotebookOptions}
                    >
                        <SlidersHorizontalIcon size={20} aria-hidden="true" />
                    </Button>
                    {activePanel && (
                        <dialog
                            open
                            id={panelId}
                            ref={optionsPanel}
                            className="wm-options-panel"
                            aria-label={optionsPanelLabel}
                        >
                            <div className="wm-options-heading">
                                <span>{optionsPanelTitle}</span>
                                <Button
                                    theme="ghost-muted"
                                    size="tiny"
                                    type="button"
                                    aria-label="Close options"
                                    onClick={closeOptions}
                                >
                                    <XIcon size={18} aria-hidden="true" />
                                </Button>
                            </div>
                            {activePanel === "pen" ? (
                                <>
                                    <fieldset className="wm-pen-types" aria-label="Pen types">
                                        {penTypeButtons}
                                    </fieldset>
                                    <svg className="wm-pen-preview" viewBox="0 0 160 44" aria-hidden="true">
                                        <StrokePath
                                            sample
                                            stroke={{
                                                points: penPreviewPoints,
                                                color: "currentColor",
                                                size: 8,
                                                tool: "pen",
                                                penStyle,
                                                simulatePressure: false,
                                            }}
                                        />
                                    </svg>
                                    <p className="wm-pen-description">{selectedPen.description}</p>
                                    <label className="wm-ink-label">
                                        Width
                                        <select aria-label="Stroke width" value={size} onChange={updateStrokeWidth}>
                                            <option value={2}>Fine</option>
                                            <option value={4}>Medium</option>
                                            <option value={8}>Bold</option>
                                        </select>
                                    </label>
                                </>
                            ) : activePanel === "link" ? (
                                <NoteLinkPicker notes={linkableNotes} onChoose={addLink} />
                            ) : activePanel === "ink" ? (
                                <>
                                    <fieldset className="wm-ink-group" aria-label="Ink colors">
                                        {inkButtons}
                                    </fieldset>
                                    <label className="wm-ink-label">
                                        Width
                                        <select aria-label="Stroke width" value={size} onChange={updateStrokeWidth}>
                                            <option value={2}>Fine</option>
                                            <option value={4}>Medium</option>
                                            <option value={8}>Bold</option>
                                        </select>
                                    </label>
                                </>
                            ) : (
                                <>
                                    <fieldset className="wm-paper-toolbar" aria-label="Paper and navigation">
                                        {!fixedPages ? (
                                            <>
                                                <label className="wm-ink-label">
                                                    Paper
                                                    <select
                                                        aria-label="Paper style"
                                                        value={notebook.paper}
                                                        onChange={changePaperStyle}
                                                    >
                                                        <option value="blank">Blank</option>
                                                        <option value="lined">Lined</option>
                                                        <option value="grid">Grid</option>
                                                        <option value="dotted">Dotted</option>
                                                    </select>
                                                </label>
                                                <PaperColor
                                                    label="Paper color"
                                                    value={appearance.background}
                                                    onChange={updatePaperBackground}
                                                />
                                                <fieldset
                                                    className="wm-paper-toolbar"
                                                    aria-label="Background details"
                                                    disabled={notebook.paper === "blank"}
                                                >
                                                    <PaperColor
                                                        label="Pattern color"
                                                        value={appearance.color}
                                                        onChange={updatePatternColor}
                                                    />
                                                    <label className="wm-ink-label">
                                                        Spacing
                                                        <select
                                                            aria-label="Pattern spacing"
                                                            value={appearance.spacing}
                                                            onChange={updatePatternSpacing}
                                                        >
                                                            <option value={16}>Compact</option>
                                                            <option value={24}>Close</option>
                                                            <option value={32}>Standard</option>
                                                            <option value={48}>Wide</option>
                                                            <option value={64}>Spacious</option>
                                                        </select>
                                                    </label>
                                                    <label className="wm-ink-label">
                                                        Weight
                                                        <select
                                                            aria-label="Pattern weight"
                                                            value={appearance.weight}
                                                            onChange={updatePatternWeight}
                                                        >
                                                            <option value={0.5}>Fine</option>
                                                            <option value={1}>Regular</option>
                                                            <option value={2}>Medium</option>
                                                            <option value={3}>Bold</option>
                                                        </select>
                                                    </label>
                                                </fieldset>
                                                <Button
                                                    theme="ghost-muted"
                                                    size="tiny"
                                                    type="button"
                                                    onClick={resetPaperAppearance}
                                                >
                                                    Reset paper appearance
                                                </Button>
                                            </>
                                        ) : null}
                                        <label className="wm-touch-toggle">
                                            <input
                                                type="checkbox"
                                                checked={drawWithTouch}
                                                onChange={updateTouchDrawing}
                                            />
                                            Draw with touch
                                        </label>
                                        <fieldset
                                            ref={zoomOptions}
                                            className="wm-ink-group"
                                            aria-label="Page zoom"
                                            title="Scroll up to zoom in, down to zoom out"
                                        >
                                            <Button
                                                theme="ghost-muted"
                                                size="tiny"
                                                type="button"
                                                aria-label="Zoom out"
                                                disabled={zoom <= 0.5}
                                                onClick={zoomOut}
                                            >
                                                −
                                            </Button>
                                            <span>{Math.round(zoom * 100)}%</span>
                                            <Button
                                                theme="ghost-muted"
                                                size="tiny"
                                                type="button"
                                                aria-label="Zoom in"
                                                disabled={zoom >= 3}
                                                onClick={zoomIn}
                                            >
                                                +
                                            </Button>
                                        </fieldset>
                                    </fieldset>
                                    <Button theme="ghost-muted" size="tiny" type="button" onClick={openLinkPicker}>
                                        <LinkSimpleIcon size={20} aria-hidden="true" />
                                        Add note link
                                    </Button>
                                    <Button
                                        theme={tool === "hand" ? "muted" : "ghost-muted"}
                                        size="tiny"
                                        type="button"
                                        aria-label="Move page"
                                        aria-pressed={tool === "hand"}
                                        onClick={movePage}
                                    >
                                        <HandIcon size={20} aria-hidden="true" />
                                        Move page
                                    </Button>
                                    <div className="wm-options-actions">
                                        <Button
                                            theme="ghost-muted"
                                            size="tiny"
                                            type="button"
                                            aria-label="Hide writing tools"
                                            onClick={hideWritingTools}
                                        >
                                            <EyeSlashIcon size={20} aria-hidden="true" />
                                            Hide tools
                                        </Button>
                                        {actions}
                                    </div>
                                </>
                            )}
                        </dialog>
                    )}
                </div>
            )}
            <div className="wm-notebook-bottom">
                <footer className="wm-notebook-footer">
                    <fieldset className="wm-ink-group" aria-label="Notebook pages">
                        <Button
                            theme="ghost-muted"
                            size="tiny"
                            type="button"
                            aria-label="Previous page"
                            disabled={pageIndex === 0}
                            onClick={previousPage}
                        >
                            ‹
                        </Button>
                        <span aria-live="polite">
                            <span className="sr-only">Page </span>
                            {pageIndex + 1} / {notebook.pages.length}
                        </span>
                        {fixedPages ? (
                            <input
                                key={pageIndex}
                                className="wm-pdf-page-number"
                                type="number"
                                aria-label="Go to page"
                                min={1}
                                max={notebook.pages.length}
                                defaultValue={pageIndex + 1}
                                onKeyDown={handlePageNumberKeyDown}
                                onBlur={handlePageNumberBlur}
                            />
                        ) : null}
                        <Button
                            theme="ghost-muted"
                            size="tiny"
                            type="button"
                            aria-label="Next page"
                            disabled={pageIndex === notebook.pages.length - 1}
                            onClick={nextPage}
                        >
                            ›
                        </Button>
                        {!fixedPages ? (
                            <Button
                                theme="ghost-muted"
                                size="tiny"
                                type="button"
                                aria-label="Add page"
                                title="Add page"
                                onClick={addPage}
                            >
                                +
                            </Button>
                        ) : null}
                    </fieldset>
                    <Button
                        theme="ghost-muted"
                        size="tiny"
                        ref={zoomReset}
                        type="button"
                        aria-label="Reset zoom"
                        title="Scroll to zoom; click to reset"
                        onClick={resetZoom}
                    >
                        {Math.round(zoom * 100)}%
                    </Button>
                    {fixedPages ? (
                        <span className="max-w-32 truncate" title={title}>
                            {title}
                        </span>
                    ) : null}
                    <div className="wm-save-state" title={saveStatus}>
                        {saveStatus === "Saved" ? (
                            <CheckIcon size={18} aria-hidden="true" />
                        ) : saveStatus === "Saving…" ? (
                            <CircleNotchIcon size={18} aria-hidden="true" className="wm-saving" />
                        ) : (
                            <WarningCircleIcon size={18} aria-hidden="true" />
                        )}
                        <output className={saveStatus === "Could not save" ? undefined : "sr-only"} aria-live="polite">
                            {saveStatus}
                        </output>
                        {saveStatus === "Could not save" ? (
                            <Button theme="ghost-muted" size="tiny" type="button" onClick={onRetry}>
                                Retry
                            </Button>
                        ) : null}
                    </div>
                </footer>
            </div>
            {linkPlacementNotice}
            <div
                className={paperViewportClassName}
                ref={viewport}
                onPointerDown={pdfGestures.onPointerDown}
                onPointerMove={pdfGestures.onPointerMove}
                onPointerUp={pdfGestures.onPointerUp}
                onPointerCancel={pdfGestures.onPointerCancel}
                onLostPointerCapture={pdfGestures.onPointerCancel}
            >
                <div className="wm-paper-space" style={paperSpaceStyle}>
                    {pageBackgroundElement}
                    <svg
                        ref={paper}
                        viewBox={`0 0 ${PAPER_WIDTH} ${pageHeight}`}
                        className={paperClassName}
                        aria-label="Handwriting canvas"
                        onPointerDown={pointerDown}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerEnd}
                        onPointerCancel={pointerCancelled}
                        onLostPointerCapture={pointerCancelled}
                    >
                        <title>Handwriting canvas</title>
                        <defs>
                            <pattern
                                id={patternId}
                                width={appearance.spacing}
                                height={appearance.spacing}
                                patternUnits="userSpaceOnUse"
                            >
                                {notebook.paper === "lined" && (
                                    <path
                                        d={`M 0 ${appearance.spacing} H ${appearance.spacing}`}
                                        className="wm-paper-rule"
                                    />
                                )}
                                {notebook.paper === "grid" && (
                                    <path
                                        d={`M ${appearance.spacing} 0 H 0 V ${appearance.spacing}`}
                                        className="wm-paper-rule"
                                    />
                                )}
                                {notebook.paper === "dotted" && (
                                    <circle
                                        cx={appearance.spacing / 2}
                                        cy={appearance.spacing / 2}
                                        r={appearance.weight * 1.5}
                                        className="wm-paper-dot"
                                    />
                                )}
                            </pattern>
                        </defs>
                        {notebook.paper !== "blank" && (
                            <rect width={PAPER_WIDTH} height={pageHeight} fill={`url(#${patternId})`} />
                        )}
                        <g>{strokeElements}</g>
                        {preview && <StrokePath stroke={preview} />}
                    </svg>
                    {noteLinkElements}
                </div>
            </div>
        </section>
    );
}
