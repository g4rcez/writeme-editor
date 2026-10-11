import { ArrowsOutCardinalIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutCardinal";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import clsx from "clsx";
import { useId, useRef, useState, type JSX, type PointerEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import type { Note } from "@/store/note";
import { PAPER_HEIGHT, PAPER_WIDTH, type FreehandNoteLink } from "@/lib/freehand-note";
import { fzfScore } from "@/lib/note-search";

export type NoteLinkTarget = Pick<Note, "id" | "title" | "filePath">;
type Position = Pick<FreehandNoteLink, "x" | "y">;

export function clampLinkPosition(
    position: Position,
    surfaceWidth = PAPER_WIDTH,
    surfaceHeight = PAPER_HEIGHT,
): Position {
    const scale = PAPER_WIDTH / surfaceWidth;
    const cardWidth = Math.min(208, surfaceWidth - 24);
    return {
        x: Math.max(12 * scale, Math.min(PAPER_WIDTH - (cardWidth + 12) * scale, position.x)),
        y: Math.max(12 * scale, Math.min(surfaceHeight - 128 * scale, position.y)),
    };
}

export function NoteLinkPicker({
    notes,
    onChoose,
}: {
    notes: readonly NoteLinkTarget[];
    onChoose: (note: NoteLinkTarget) => void;
}): JSX.Element {
    const [query, setQuery] = useState("");
    const results = notes
        .map((note) => ({ note, score: fzfScore(query, `${note.title} ${note.filePath ?? ""}`) }))
        .filter((item): item is { note: NoteLinkTarget; score: number } => item.score !== null)
        .sort((left, right) => right.score - left.score);
    return (
        <>
            <label className="wm-link-search">
                Search notes
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <ul className="wm-link-results" aria-label="Notes to link">
                {results.map(({ note }) => (
                    <li key={note.id}>
                        <button type="button" className="wm-link-result" onClick={() => onChoose(note)}>
                            <span>{note.title || "Untitled"}</span>
                            {note.filePath && <small>{note.filePath}</small>}
                        </button>
                    </li>
                ))}
            </ul>
            {!results.length && (
                <output className="wm-link-empty">
                    {notes.length ? "No notes match your search." : "Create another note to link it here."}
                </output>
            )}
        </>
    );
}

export function StickyNoteLink({
    link,
    target,
    paper,
    placing,
    onMove,
    onPlace,
    onRemove,
}: {
    link: FreehandNoteLink;
    target?: NoteLinkTarget;
    paper: RefObject<SVGSVGElement | null>;
    placing: boolean;
    onMove: (position: Position) => void;
    onPlace: () => void;
    onRemove: () => void;
}): JSX.Element {
    const title = target?.title || link.title || "Untitled";
    const descriptionId = useId();
    const [preview, setPreview] = useState<Position | null>(null);
    const drag = useRef<{
        pointerId: number;
        x: number;
        y: number;
        position: Position;
        scale: number;
        preview: Position | null;
    } | null>(null);
    const moved = useRef(false);
    const ignoreClick = useRef(false);
    const position = preview ?? link;

    function startDrag(event: PointerEvent<HTMLButtonElement>): void {
        if (event.button !== 0 || !event.isPrimary || event.width > 40 || event.height > 40) return;
        const surface = paper.current?.getBoundingClientRect();
        const card = event.currentTarget.closest(".wm-sticky-link")?.getBoundingClientRect();
        if (!surface || !card) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        moved.current = false;
        ignoreClick.current = false;
        drag.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            position: {
                x: ((card.x - surface.x) / surface.width) * PAPER_WIDTH,
                y: ((card.y - surface.y) / surface.width) * PAPER_WIDTH,
            },
            scale: PAPER_WIDTH / surface.width,
            preview: null,
        };
    }

    function moveDrag(event: PointerEvent<HTMLButtonElement>): void {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 3 && !moved.current) return;
        moved.current = true;
        active.preview = clampLinkPosition(
            {
                x: active.position.x + (event.clientX - active.x) * active.scale,
                y: active.position.y + (event.clientY - active.y) * active.scale,
            },
            PAPER_WIDTH / active.scale,
            paper.current?.viewBox.baseVal.height,
        );
        setPreview(active.preview);
    }

    function endDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false): void {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        drag.current = null;
        ignoreClick.current = true;
        if (!cancelled) {
            if (moved.current && active.preview) onMove(active.preview);
            else if (!moved.current) onPlace();
        }
        setPreview(null);
    }

    return (
        <fieldset
            aria-label={`Linked note: ${title}`}
            className={clsx("wm-sticky-link", placing && "wm-sticky-link--placing")}
            style={{
                left: `clamp(0.75rem, ${(position.x / PAPER_WIDTH) * 100}%, max(0.75rem, calc(100% - 13rem - 0.75rem)))`,
                top: `clamp(0.75rem, ${(position.y / PAPER_HEIGHT) * 100}%, max(0.75rem, calc(100% - 8rem)))`,
            }}
        >
            <div className="wm-sticky-actions">
                <button
                    type="button"
                    className="wm-ink-control wm-sticky-handle"
                    aria-label={`Move linked note: ${title}`}
                    aria-describedby={descriptionId}
                    aria-pressed={placing}
                    title="Drag, use arrow keys, or tap then choose a position"
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={(event) => endDrag(event)}
                    onPointerCancel={(event) => endDrag(event, true)}
                    onLostPointerCapture={(event) => endDrag(event, true)}
                    onClick={(event) => {
                        if (event.detail === 0 || !ignoreClick.current) onPlace();
                        ignoreClick.current = false;
                    }}
                    onKeyDown={(event) => {
                        const steps: Record<string, Position> = {
                            ArrowLeft: { x: -20, y: 0 },
                            ArrowRight: { x: 20, y: 0 },
                            ArrowUp: { x: 0, y: -20 },
                            ArrowDown: { x: 0, y: 20 },
                        };
                        const step = steps[event.key];
                        if (!step) return;
                        ignoreClick.current = false;
                        event.preventDefault();
                        event.stopPropagation();
                        onMove(
                            clampLinkPosition(
                                { x: link.x + step.x, y: link.y + step.y },
                                paper.current?.getBoundingClientRect().width,
                                paper.current?.viewBox.baseVal.height,
                            ),
                        );
                    }}
                >
                    <ArrowsOutCardinalIcon size={18} aria-hidden="true" />
                </button>
                <LinkSimpleIcon size={16} aria-hidden="true" />
                <button
                    type="button"
                    className="wm-ink-control"
                    aria-label={`Remove linked note: ${title}`}
                    onClick={onRemove}
                >
                    <XIcon size={18} aria-hidden="true" />
                </button>
            </div>
            <span id={descriptionId} className="sr-only">
                Drag to move, use arrow keys, or activate then tap the paper to place.
            </span>
            {target ? (
                <Link
                    className="wm-sticky-open"
                    aria-label={`Open note: ${title}`}
                    to={`/note/${encodeURIComponent(target.id)}`}
                >
                    <span>{title}</span>
                    <ArrowUpRightIcon size={18} aria-hidden="true" />
                </Link>
            ) : (
                <div className="wm-sticky-unavailable">
                    <span>{title}</span>
                    <small>Note unavailable</small>
                </div>
            )}
        </fieldset>
    );
}
