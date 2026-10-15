import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    MeasuringStrategy,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox, Input, Modal, Select, Textarea } from "@g4rcez/components";
import { CheckCircleIcon, CircleIcon, DotsSixVerticalIcon, KanbanIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, type JSX, type ReactNode } from "react";
import { useBlocker, useSearchParams } from "react-router-dom";
import { useReducer } from "use-typed-reducer";
import type { Note } from "@/store/note";
import { Editor } from "@/app/editor";
import { setTaskItemChecked } from "@/app/elements/task-list-item";
import { getEditorMarkdown } from "@/lib/editor-storage";
import { exportFile } from "@/lib/export-file";
import { taskNoteExtensions } from "@/lib/task-note";
import { parseOpenWorkspaceTasks } from "@/lib/workspace-tasks";
import { globalDispatch, globalState, repositories } from "@/store/global.store";
import {
    addTaskToStack,
    moveTaskItemBetweenStacks,
    parseEditorTasks,
    updateTaskContent,
    type Card,
    type Stack,
} from "./tasks-dialog";

type TaskDraft = { card?: Card; stack: Stack; title: string; description: string; destination: number };
type Filter = "all" | "active" | "backlog";

type TaskViewState = {
    view: "board" | "markdown";
    filter: Filter;
    markdown: string;
    search: string;
    draggedCard: Card | null;
    hideEmpty: boolean;
    status: "Saved" | "Saving" | "Could not save";
    notice: string | null;
    draft: TaskDraft | null;
    columnDraft: { stack?: Stack; title: string } | null;
};

const taskViewReducers = () => ({
    setView: (view: TaskViewState["view"]): Partial<TaskViewState> => ({ view }),
    setFilter: (filter: Filter): Partial<TaskViewState> => ({ filter }),
    setMarkdown: (markdown: string): Partial<TaskViewState> => ({ markdown }),
    setSearch: (search: string): Partial<TaskViewState> => ({ search }),
    setDraggedCard: (draggedCard: Card | null): Partial<TaskViewState> => ({ draggedCard }),
    setHideEmpty: (hideEmpty: boolean): Partial<TaskViewState> => ({ hideEmpty }),
    setStatus: (status: TaskViewState["status"]): Partial<TaskViewState> => ({ status }),
    setNotice: (notice: string | null): Partial<TaskViewState> => ({ notice }),
    setDraft: (draft: TaskDraft | null): Partial<TaskViewState> => ({ draft }),
    setColumnDraft: (columnDraft: TaskViewState["columnDraft"]): Partial<TaskViewState> => ({ columnDraft }),
    clearFilters: (): Partial<TaskViewState> => ({ search: "", filter: "all", hideEmpty: false }),
});

function taskTitle(card: Card): string {
    return card.checked ? card.title.replace(/\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, "") : card.title;
}

const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return sortableKeyboardCoordinates(event, args);
    event.preventDefault();
    const { context } = args;
    const currentId = context.over?.id ?? context.active?.id;
    if (currentId === undefined) return;
    const current = context.droppableContainers.get(currentId);
    const containerId: unknown = String(currentId).startsWith("stack-")
        ? currentId
        : current?.data.current?.sortable?.containerId;
    const columns = context.droppableContainers
        .getEnabled()
        .filter((entry) => String(entry.id).startsWith("stack-"))
        .sort(
            (left, right) =>
                (context.droppableRects.get(left.id)?.left ?? 0) - (context.droppableRects.get(right.id)?.left ?? 0),
        );
    const index = columns.findIndex((column) => column.id === containerId);
    if (index < 0) return;
    const destination = columns[index + (event.code === "ArrowRight" ? 1 : -1)];
    const rect = destination ? context.droppableRects.get(destination.id) : null;
    if (rect) return { x: rect.left, y: rect.top };
};

function TaskCard({ card, onEdit, onToggle }: { card: Card; onEdit: () => void; onToggle: () => void }): JSX.Element {
    const title = taskTitle(card);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
    });
    return (
        <article
            ref={setNodeRef}
            style={{ transform: isDragging ? undefined : CSS.Transform.toString(transform), transition }}
            className={`wm-task-card rounded-lg border border-border bg-background shadow-[0_1px_2px_color-mix(in_srgb,var(--var-color-foreground)_4%,transparent)] ${isDragging ? "wm-task-card--dragging opacity-40" : ""}`}
            data-task-id={card.id}
        >
            <div className="wm-task-card-top flex items-start gap-1.5 p-2 text-muted-foreground">
                <button
                    ref={setActivatorNodeRef}
                    type="button"
                    className="wm-task-icon inline-flex size-7 shrink-0 items-center justify-center rounded-[5px] hover:bg-muted hover:text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 wm-task-drag cursor-grab touch-none active:cursor-grabbing"
                    aria-label={`Move ${title}`}
                    {...attributes}
                    {...listeners}
                >
                    <DotsSixVerticalIcon size={16} />
                </button>
                <button
                    type="button"
                    className="wm-task-card-content flex min-w-0 flex-1 flex-col gap-2 pb-2 pt-[3px] text-left text-sm leading-normal text-foreground [overflow-wrap:anywhere]"
                    onClick={onEdit}
                    aria-label={`Edit ${title}`}
                >
                    <span className={card.checked ? "wm-task-completed text-muted-foreground line-through" : ""}>
                        {title || "Untitled task"}
                    </span>
                    {card.description ? (
                        <span className="wm-task-description line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{card.description}</span>
                    ) : null}
                </button>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-pressed={!!card.checked}
                    aria-label={`${card.checked ? "Reopen" : "Complete"} ${title}`}
                    className="wm-task-icon inline-flex size-7 shrink-0 items-center justify-center rounded-[5px] hover:bg-muted hover:text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                >
                    {card.checked ? <CheckCircleIcon aria-hidden weight="fill" size={18} className="text-success" /> : <CircleIcon size={18} />}
                </button>
            </div>
        </article>
    );
}

function Column({
    stack,
    cards,
    onAdd,
    onRename,
    children,
}: {
    stack: Stack;
    cards: Card[];
    onAdd: () => void;
    onRename: () => void;
    children: ReactNode;
}): JSX.Element {
    const { setNodeRef, isOver } = useDroppable({ id: `stack-${stack.pos}` });
    return (
        <section
            className={`wm-task-column shrink-0 grow-0 basis-[300px] rounded-lg bg-muted/35 p-3 max-[700px]:basis-[min(300px,85vw)] ${isOver ? "wm-task-column--over outline outline-2 outline-primary -outline-offset-2" : ""}`}
            aria-label={`${stack.title} column`}
        >
            <header className="wm-task-column-header mb-4 flex items-center gap-2 text-muted-foreground">
                <CircleIcon size={16} aria-hidden="true" />
                <button
                    type="button"
                    className="wm-task-column-name truncate text-left text-sm font-medium text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                    aria-label={`Rename ${stack.title} column`}
                    onClick={onRename}
                >
                    {stack.title}
                </button>
                <span className="wm-task-count mr-auto text-xs">{cards.length}</span>
                <button
                    type="button"
                    className="wm-task-icon inline-flex size-7 shrink-0 items-center justify-center rounded-[5px] hover:bg-muted hover:text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                    onClick={onAdd}
                    aria-label={`Add task to ${stack.title}`}
                >
                    <PlusIcon size={16} />
                </button>
            </header>
            <SortableContext
                id={`stack-${stack.pos}`}
                items={cards.map((card) => card.id)}
                strategy={verticalListSortingStrategy}
            >
                <div ref={setNodeRef} className="wm-task-column-cards flex min-h-[120px] flex-col gap-2.5">
                    {children}
                    {cards.length === 0 && stack.cards.length > 0 && !isOver ? (
                        <p className="wm-task-empty rounded-lg p-3 text-xs text-muted-foreground">No matching tasks</p>
                    ) : cards.length === 0 ? (
                        <button type="button" className="wm-task-empty rounded-lg border border-dashed border-border p-3 text-left text-xs text-muted-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11" onClick={onAdd}>
                            {isOver ? "Drop task here" : "Add a task"}
                        </button>
                    ) : null}
                </div>
            </SortableContext>
        </section>
    );
}

    const initialState: TaskViewState = {
        view: "board",
        filter: "all",
        markdown: "",
        search: "",
        draggedCard: null,
        hideEmpty: false,
        status: "Saved",
        notice: null,
        draft: null,
        columnDraft: null,
    };

export function TaskNoteView({ note, actions }: { note: Note; actions?: ReactNode }): JSX.Element {
    const [state, dispatch] = useReducer({ ...initialState, markdown: note.content }, taskViewReducers);
    const [searchParams] = useSearchParams();
    const sourceLine = Number(searchParams.get("line"));
    const { view, filter, markdown, search, draggedCard, hideEmpty, status, notice, draft, columnDraft } = state;
    const pending = useRef(Promise.resolve());
    const persisted = useRef(note);
    const latest = useRef(note.content);
    const revision = useRef(0);
    const mounted = useRef(true);
    const blockedByConflict = useRef(false);
    const searchInput = useRef<HTMLInputElement>(null);
    const blocker = useBlocker(status !== "Saved");
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
    );

    const save = useCallback(
        (content: string): Promise<void> => {
            latest.current = content;
            const currentRevision = ++revision.current;
            dispatch.setStatus("Saving");
            pending.current = pending.current.then(async () => {
                try {
                    const existing = await repositories.notes.getOne(note.id);
                    if (blockedByConflict.current || !existing || existing.content !== persisted.current.content) {
                        blockedByConflict.current = true;
                        throw new Error(
                            "This board changed in another editor. Download your local copy before reopening the saved board.",
                        );
                    }
                    const updated = await repositories.notes.updateContentIfUnchanged(note.id, existing, content);
                    if (!updated) {
                        blockedByConflict.current = true;
                        throw new Error(
                            "This board changed in another editor. Download your local copy before reopening the saved board.",
                        );
                    }
                    persisted.current = updated;
                    const state = globalState();
                    globalDispatch.notes(state.notes.map((item) => (item.id === note.id ? updated : item)));
                    if (state.note?.id === note.id) globalDispatch.setNote(updated);
                    if (mounted.current && revision.current === currentRevision) {
                        dispatch.setStatus("Saved");
                        dispatch.setNotice(null);
                    }
                } catch (error) {
                    if (mounted.current && revision.current === currentRevision) {
                        dispatch.setStatus("Could not save");
                        dispatch.setNotice(
                            error instanceof Error ? error.message : "Could not save. Retry or download a local copy.",
                        );
                    }
                }
            });
            return pending.current;
        },
        [dispatch, note.id],
    );

    const editor = useEditor({
        extensions: taskNoteExtensions(),
        content: note.content,
        editable: false,
        onUpdate: ({ editor: current }) => {
            const content = getEditorMarkdown(current);
            dispatch.setMarkdown(content);
            save(content);
        },
    });

    const stacks = editor ? parseEditorTasks(editor.state.doc) : [];
    useEffect(() => {
        if (!editor || !sourceLine) return;
        const source = parseOpenWorkspaceTasks([note]).find((task) => task.line === sourceLine);
        if (!source) return;
        let index = 0;
        let position: number | null = null;
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "taskItem" && index++ === source.taskIndex) position = pos;
        });
        if (position === null) return;
        const card = parseEditorTasks(editor.state.doc)
            .flatMap((stack) => stack.cards)
            .find((item) => item.pos === position);
        if (!card) {
            dispatch.setView("markdown");
            return;
        }
        const frame = requestAnimationFrame(() => {
            const target = document.querySelector<HTMLElement>(`.wm-task-card[data-task-id="${card.id}"]`);
            target?.querySelector<HTMLButtonElement>(".wm-task-card-content")?.focus({ preventScroll: true });
            target?.scrollIntoView({ behavior: "instant", block: "center" });
        });
        return () => cancelAnimationFrame(frame);
    }, [dispatch, editor, note, sourceLine]);
    useEffect(() => {
        if (!editor || getEditorMarkdown(editor) === markdown) return;
        editor.commands.setContent(markdown, { emitUpdate: false });
    }, [editor, markdown]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (
                view !== "board" ||
                !(event.ctrlKey || event.metaKey) ||
                event.altKey ||
                event.shiftKey ||
                event.key.toLowerCase() !== "m"
            ) {
                return;
            }
            const target = event.target;
            if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) {
                return;
            }
            event.preventDefault();
            dispatch.setView("markdown");
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [dispatch, view]);
    useEffect(() => {
        if (status === "Saved" && blocker.state === "blocked") blocker.proceed();
    }, [status, blocker]);
    useEffect(() => {
        if (status === "Saved") return;
        const beforeUnload = (event: BeforeUnloadEvent): void => event.preventDefault();
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [status]);

    function download(): void {
        void exportFile(
            `${note.title || "Tasks"}-local-copy.md`,
            new Blob([latest.current], { type: "text/markdown;charset=utf-8" }),
        ).catch((error: unknown) =>
            dispatch.setNotice(error instanceof Error ? error.message : "Could not download the board."),
        );
    }
    function toggle(card: Card): void {
        if (!editor || card.pos === undefined) return;
        editor
            .chain()
            .command(({ tr }) => {
                return setTaskItemChecked(tr, { taskPos: card.pos!, checked: !card.checked });
            })
            .run();
    }
    function move(event: DragEndEvent): void {
        if (!editor || !event.over || event.active.id === event.over.id) return;
        const current = parseEditorTasks(editor.state.doc);
        const card = current.flatMap((stack) => stack.cards).find((item) => item.id === event.active.id);
        const before = current.flatMap((stack) => stack.cards).find((item) => item.id === event.over?.id);
        const destination = current.find(
            (stack) => `stack-${stack.pos}` === event.over?.id || stack.cards.some((item) => item.id === before?.id),
        );
        if (card && destination) moveTaskItemBetweenStacks(editor, card, destination, before);
    }
    function commitTask(): void {
        if (!editor || !draft?.title.trim()) return;
        const stackIndex = stacks.findIndex((stack) => stack.pos === draft.stack.pos);
        const cardIndex = draft.card ? draft.stack.cards.findIndex((item) => item.id === draft.card?.id) : -1;
        if (draft.card) {
            updateTaskContent(editor, draft.card, { title: draft.title.trim(), description: draft.description });
            if (draft.card.checked) {
                const card = parseEditorTasks(editor.state.doc)[stackIndex]?.cards[cardIndex];
                const timestamp = draft.card.title.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)?.[0];
                if (card?.pos !== undefined) {
                    const taskPos = card.pos;
                    editor
                        .chain()
                        .command(({ tr }) =>
                            setTaskItemChecked(tr, {
                                taskPos,
                                checked: true,
                                finishedAt: timestamp ? new Date(timestamp.replace(" ", "T")) : undefined,
                            }),
                        )
                        .run();
                }
            }
            if (draft.destination !== stackIndex) {
                const current = parseEditorTasks(editor.state.doc);
                const card = current[stackIndex]?.cards[cardIndex];
                const destination = current[draft.destination];
                if (card && destination) moveTaskItemBetweenStacks(editor, card, destination);
            }
        } else {
            const destination = stacks[draft.destination];
            if (destination)
                addTaskToStack(editor, destination, { title: draft.title.trim(), description: draft.description });
        }
        dispatch.setDraft(null);
    }
    function deleteTask(): void {
        if (!editor || !draft?.card || draft.card.pos === undefined) return;
        const card = draft.card;
        editor
            .chain()
            .command(({ tr }) => {
                const list = card.parentTaskListPos === undefined ? null : tr.doc.nodeAt(card.parentTaskListPos);
                if (list?.childCount === 1) tr.delete(card.parentTaskListPos!, card.parentTaskListPos! + list.nodeSize);
                else tr.delete(card.pos!, card.pos! + (tr.doc.nodeAt(card.pos!)?.nodeSize ?? 0));
                return true;
            })
            .run();
        dispatch.setDraft(null);
    }
    function commitColumn(): void {
        if (!editor || !columnDraft?.title.trim()) return;
        const title = columnDraft.title.trim();
        const stack = columnDraft.stack;
        if (stack?.pos !== undefined) {
            const node = editor.state.doc.nodeAt(stack.pos);
            if (node?.type.name === "heading")
                editor
                    .chain()
                    .insertContentAt(
                        { from: stack.pos + 1, to: stack.pos + node.nodeSize - 1 },
                        { type: "text", text: title },
                    )
                    .run();
        } else {
            editor
                .chain()
                .insertContentAt(editor.state.doc.content.size, {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [{ type: "text", text: title }],
                })
                .run();
        }
        dispatch.setColumnDraft(null);
    }
    function removeColumn(): void {
        const stack = columnDraft?.stack;
        if (!editor || !stack || stack.cards.length || stack.pos === undefined) return;
        editor
            .chain()
            .deleteRange({ from: stack.pos, to: stack.endPos ?? editor.state.doc.content.size })
            .run();
        dispatch.setColumnDraft(null);
    }
    const shown = stacks
        .map((stack) => ({
            stack,
            cards: stack.cards.filter((card) => {
                if (filter === "active" && (card.checked || stack.title.toLowerCase() === "backlog")) return false;
                if (filter === "backlog" && stack.title.toLowerCase() !== "backlog") return false;
                return `${card.title} ${card.description}`.toLowerCase().includes(search.toLowerCase());
            }),
        }))
        .filter(
            ({ cards, stack }) =>
                (!hideEmpty || cards.length > 0) && (filter !== "backlog" || stack.title.toLowerCase() === "backlog"),
        );
    const totalTasks = stacks.reduce((count, stack) => count + stack.cards.length, 0);
    const visibleTasks = shown.reduce((count, column) => count + column.cards.length, 0);
    const hasFilters = search !== "" || filter !== "all" || hideEmpty;

    function clearFilters(): void {
        dispatch.clearFilters();
        searchInput.current?.focus();
    }

    return (
        <div className="wm-task-view flex h-full min-h-0 flex-col my-0 bg-background text-foreground [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-primary [&_button:focus-visible]:outline-offset-2">
            <header className="wm-task-header flex items-center gap-3 border-b border-border px-6 py-4 max-[700px]:flex-wrap max-[700px]:gap-2 max-[700px]:p-3">
                <KanbanIcon size={20} className="text-primary" aria-hidden="true" />
                <h1 className="truncate text-base font-semibold max-[700px]:max-w-[45%]">{note.title || "Tasks"}</h1>
                <output className="wm-task-save ml-auto whitespace-nowrap text-xs text-muted-foreground">{status}</output>
                {actions}
                <div className="wm-task-view-switch flex gap-1" aria-label="Task view">
                    <button type="button" className="rounded-full px-3 py-[7px] text-[13px] whitespace-nowrap text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11" aria-pressed={view === "board"} onClick={() => dispatch.setView("board")}>
                        Board
                    </button>
                    <button type="button" className="rounded-full px-3 py-[7px] text-[13px] whitespace-nowrap text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11" aria-pressed={view === "markdown"} onClick={() => dispatch.setView("markdown")}>
                        Markdown
                    </button>
                </div>
            </header>
            {notice ? (
                <aside role="alert" className="wm-task-notice flex flex-wrap items-center gap-2 bg-muted px-6 py-3 text-[13px]">
                    <p>{notice}</p>
                    <Button onClick={() => save(latest.current)}>Retry</Button>
                    <Button theme="ghost-muted" onClick={download}>
                        Download local copy
                    </Button>
                </aside>
            ) : null}
            {view === "markdown" ? (
                <Editor
                    note={note}
                    content={markdown}
                    mode={sourceLine ? "markdown" : "formatted"}
                    onSave={async (content) => {
                        dispatch.setMarkdown(content);
                        await save(content);
                    }}
                />
            ) : (
                <>
                    <div
                        role="toolbar"
                        aria-label="Task board tools"
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 max-[700px]:px-3"
                    >
                        <Input
                            ref={searchInput}
                            size="small"
                            type="search"
                            value={search}
                            aria-label="Search tasks"
                            placeholder="Search tasks…"
                            container="mr-auto min-w-0 w-full sm:w-72"
                            onChange={(event) => dispatch.setSearch(event.target.value)}
                            left={<MagnifyingGlassIcon size={16} aria-hidden="true" className="text-muted-foreground" />}
                        />
                        <fieldset aria-label="Task scope" className="flex flex-wrap gap-1">
                            {([
                                ["all", "All tasks"],
                                ["active", "Active"],
                                ["backlog", "Backlog"],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={filter === value}
                                    onClick={() => dispatch.setFilter(value)}
                                    className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
                                >
                                    {label}
                                </button>
                            ))}
                        </fieldset>
                        {hasFilters ? (
                            <button type="button" className="min-h-11 rounded-lg px-3 text-sm text-primary hover:bg-muted" onClick={clearFilters}>
                                Clear filters
                            </button>
                        ) : null}
                        <div className="flex items-center gap-4 max-sm:w-full max-sm:justify-between">
                            <Checkbox
                                checked={hideEmpty}
                                onChange={(event) => dispatch.setHideEmpty(event.target.checked)}
                            >
                                <span className="whitespace-nowrap text-sm text-muted-foreground">Hide empty columns</span>
                            </Checkbox>
                            <Button
                                size="small"
                                theme="ghost-muted"
                                className="shrink-0 whitespace-nowrap [@media(pointer:coarse)]:min-h-11"
                                onClick={() => dispatch.setColumnDraft({ title: "" })}
                            >
                                <PlusIcon size={16} aria-hidden="true" />
                                Add column
                            </Button>
                        </div>
                    </div>
                    {totalTasks > 0 && visibleTasks === 0 ? (
                        <output className="px-6 pb-2 text-sm text-muted-foreground max-[700px]:px-3">
                            No tasks match these filters.
                        </output>
                    ) : null}
                    <DndContext
                        onDragStart={({ active }) => {
                            dispatch.setDraggedCard(stacks.flatMap((stack) => stack.cards).find((card) => card.id === active.id) ?? null);
                        }}
                        onDragCancel={() => dispatch.setDraggedCard(null)}
                        onDragEnd={(event) => {
                            dispatch.setDraggedCard(null);
                            move(event);
                        }}
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                    >
                        <section className="wm-task-board flex min-h-0 flex-1 items-stretch gap-5 overflow-auto px-6 pb-6 pt-2 max-[700px]:gap-3 max-[700px]:px-3" aria-label="Task board">
                            {shown.map(({ stack, cards }) => (
                                <Column
                                    key={`stack-${stack.pos}`}
                                    stack={stack}
                                    cards={cards}
                                    onRename={() => dispatch.setColumnDraft({ stack, title: stack.title })}
                                    onAdd={() =>
                                        dispatch.setDraft({
                                            stack,
                                            title: "",
                                            description: "",
                                            destination: stacks.indexOf(stack),
                                        })
                                    }
                                >
                                    {cards.map((card) => (
                                        <TaskCard
                                            key={card.id}
                                            card={card}
                                            onEdit={() =>
                                                dispatch.setDraft({
                                                    card,
                                                    stack,
                                                    title: taskTitle(card),
                                                    description: card.description,
                                                    destination: stacks.indexOf(stack),
                                                })
                                            }
                                            onToggle={() => toggle(card)}
                                        />
                                    ))}
                                </Column>
                            ))}
                            {shown.length === 0 ? (
                                <div className="wm-task-board-empty m-auto text-center text-muted-foreground">
                                    <p>
                                        {stacks.length === 0
                                            ? "Add a column to start your task board."
                                            : "No tasks match this view."}
                                    </p>
                                    <Button
                                        theme="ghost-muted"
                                        onClick={() => {
                                            clearFilters();
                                            if (!stacks.length) dispatch.setColumnDraft({ title: "" });
                                        }}
                                    >
                                        {stacks.length === 0 ? "Add column" : "Show all columns"}
                                    </Button>
                                </div>
                            ) : null}
                        </section>
                        <DragOverlay>
                            {draggedCard ? (
                                <article
                                    aria-hidden="true"
                                    data-testid="task-drag-preview"
                                    className="pointer-events-none flex items-start gap-1.5 rounded-lg border border-border bg-background p-2 text-foreground shadow-lg"
                                >
                                    <DotsSixVerticalIcon size={16} className="m-1.5 shrink-0 text-muted-foreground" />
                                    <div className="flex min-w-0 flex-1 flex-col gap-2 pb-2 pt-[3px] text-sm [overflow-wrap:anywhere]">
                                        <span className={draggedCard.checked ? "text-muted-foreground line-through" : ""}>
                                            {taskTitle(draggedCard) || "Untitled task"}
                                        </span>
                                        {draggedCard.description ? (
                                            <span className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                                                {draggedCard.description}
                                            </span>
                                        ) : null}
                                    </div>
                                    {draggedCard.checked ? (
                                        <CheckCircleIcon weight="fill" size={18} className="m-1 shrink-0 text-muted-foreground" />
                                    ) : (
                                        <CircleIcon size={18} className="m-1 shrink-0 text-muted-foreground" />
                                    )}
                                </article>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </>
            )}
            <Modal
                open={!!draft}
                className="lg:max-w-desktop container"
                onChange={() => dispatch.setDraft(null)}
                title={draft?.card ? "Edit task" : "New task"}
            >
                {draft ? (
                    <form
                        className="wm-task-form flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            commitTask();
                        }}
                    >
                        <Input
                            title="Title"
                            required
                            aria-label="Task title"
                            value={draft.title}
                            onChange={(event) => dispatch.setDraft({ ...draft, title: event.target.value })}
                        />
                        <Textarea
                            title="Description"
                            aria-label="Task description"
                            value={draft.description}
                            onChange={(event) => dispatch.setDraft({ ...draft, description: event.target.value })}
                        />
                        <Select
                            aria-label="Task column"
                            value={draft.destination}
                            options={stacks.map((x, index) => ({ value: index.toString(), label: x.title }))}
                            onChange={(event) => dispatch.setDraft({ ...draft, destination: Number(event.target.value) })}
                        />
                        <div className="wm-task-form-actions mt-2 flex flex-wrap justify-end gap-2">
                            {draft.card ? (
                                <Button type="button" theme="ghost-muted" onClick={deleteTask}>
                                    Delete task
                                </Button>
                            ) : null}
                            <Button type="button" theme="ghost-muted" onClick={() => dispatch.setDraft(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!draft.title.trim()}>
                                {draft.card ? "Save task" : "Create task"}
                            </Button>
                        </div>
                    </form>
                ) : null}
            </Modal>
            <Modal
                open={!!columnDraft}
                onChange={() => dispatch.setColumnDraft(null)}
                title={columnDraft?.stack ? "Edit column" : "New column"}
                className="max-w-md"
            >
                {columnDraft ? (
                    <form
                        className="wm-task-form flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            commitColumn();
                        }}
                    >
                        <label className="flex flex-col gap-1.5 text-[13px]">
                            Column name
                            <input
                                required
                                className="rounded-md border border-border bg-background px-2.5 py-2 text-foreground"
                                aria-label="Column name"
                                value={columnDraft.title}
                                onChange={(event) => dispatch.setColumnDraft({ ...columnDraft, title: event.target.value })}
                            />
                        </label>
                        <div className="wm-task-form-actions mt-2 flex flex-wrap justify-end gap-2">
                            {columnDraft.stack && columnDraft.stack.cards.length === 0 ? (
                                <Button type="button" theme="ghost-muted" onClick={removeColumn}>
                                    Delete column
                                </Button>
                            ) : null}
                            <Button type="button" theme="ghost-muted" onClick={() => dispatch.setColumnDraft(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!columnDraft.title.trim()}>
                                Save column
                            </Button>
                        </div>
                    </form>
                ) : null}
            </Modal>
            <Modal
                open={blocker.state === "blocked"}
                title="Unsaved tasks"
                onChange={() => {
                    if (blocker.state === "blocked") blocker.reset();
                }}
            >
                <p>Your latest tasks are being saved or need a retry. Stay here or download a copy before leaving.</p>
                <div className="wm-task-form-actions mt-2 flex flex-wrap justify-end gap-2">
                    <Button
                        onClick={() => {
                            if (blocker.state === "blocked") blocker.reset();
                        }}
                    >
                        Stay in board
                    </Button>
                    <Button theme="ghost-muted" onClick={download}>
                        Download local copy
                    </Button>
                    <Button
                        theme="ghost-muted"
                        disabled={status === "Saving"}
                        onClick={() => {
                            if (blocker.state === "blocked") blocker.proceed();
                        }}
                    >
                        Leave without saving
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
