import {
    DndContext,
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
import { Button, Modal } from "@g4rcez/components";
import { CheckCircleIcon, CircleIcon, DotsSixVerticalIcon, KanbanIcon, PlusIcon } from "@phosphor-icons/react";
import { useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";
import type { Note } from "@/store/note";
import { setTaskItemChecked } from "@/app/elements/task-list-item";
import { getEditorMarkdown } from "@/lib/editor-storage";
import { exportFile } from "@/lib/export-file";
import { taskNoteExtensions } from "@/lib/task-note";
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
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`wm-task-card ${isDragging ? "wm-task-card--dragging" : ""}`}
            data-task-id={card.id}
        >
            <div className="wm-task-card-top">
                <button
                    ref={setActivatorNodeRef}
                    type="button"
                    className="wm-task-icon wm-task-drag"
                    aria-label={`Move ${title}`}
                    {...attributes}
                    {...listeners}
                >
                    <DotsSixVerticalIcon size={16} />
                </button>
                <button
                    type="button"
                    className="wm-task-icon"
                    aria-label={`${card.checked ? "Reopen" : "Complete"} ${title}`}
                    aria-pressed={!!card.checked}
                    onClick={onToggle}
                >
                    {card.checked ? <CheckCircleIcon weight="fill" size={18} /> : <CircleIcon size={18} />}
                </button>
            </div>
            <button type="button" className="wm-task-card-content" onClick={onEdit} aria-label={`Edit ${title}`}>
                <span className={card.checked ? "wm-task-completed" : ""}>{title || "Untitled task"}</span>
                {card.description ? <span className="wm-task-description">{card.description}</span> : null}
            </button>
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
            className={`wm-task-column ${isOver ? "wm-task-column--over" : ""}`}
            aria-label={`${stack.title} column`}
        >
            <header className="wm-task-column-header">
                <CircleIcon size={16} aria-hidden="true" />
                <button
                    type="button"
                    className="wm-task-column-name"
                    aria-label={`Rename ${stack.title} column`}
                    onClick={onRename}
                >
                    {stack.title}
                </button>
                <span className="wm-task-count">{cards.length}</span>
                <button
                    type="button"
                    className="wm-task-icon"
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
                <div ref={setNodeRef} className="wm-task-column-cards">
                    {children}
                    {cards.length === 0 ? (
                        <button type="button" className="wm-task-empty" onClick={onAdd}>
                            {isOver ? "Drop task here" : "Add a task"}
                        </button>
                    ) : null}
                </div>
            </SortableContext>
        </section>
    );
}

export function TaskNoteView({ note, actions }: { note: Note; actions?: ReactNode }): JSX.Element {
    const [view, setView] = useState<"board" | "markdown">("board");
    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");
    const [hideEmpty, setHideEmpty] = useState(false);
    const [markdown, setMarkdown] = useState(note.content);
    const [status, setStatus] = useState<"Saved" | "Saving" | "Could not save">("Saved");
    const [notice, setNotice] = useState<string | null>(null);
    const [draft, setDraft] = useState<TaskDraft | null>(null);
    const [columnDraft, setColumnDraft] = useState<{ stack?: Stack; title: string } | null>(null);
    const pending = useRef(Promise.resolve());
    const persisted = useRef(note);
    const latest = useRef(note.content);
    const revision = useRef(0);
    const mounted = useRef(true);
    const blockedByConflict = useRef(false);
    const blocker = useBlocker(status !== "Saved");
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
    );

    const save = useCallback(
        (content: string): void => {
            latest.current = content;
            const currentRevision = ++revision.current;
            setStatus("Saving");
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
                        setStatus("Saved");
                        setNotice(null);
                    }
                } catch (error) {
                    if (mounted.current && revision.current === currentRevision) {
                        setStatus("Could not save");
                        setNotice(
                            error instanceof Error ? error.message : "Could not save. Retry or download a local copy.",
                        );
                    }
                }
            });
        },
        [note.id],
    );

    const editor = useEditor({
        extensions: taskNoteExtensions(),
        content: note.content,
        editable: false,
        onUpdate: ({ editor: current }) => {
            const content = getEditorMarkdown(current);
            setMarkdown(content);
            save(content);
        },
    });

    const stacks = editor ? parseEditorTasks(editor.state.doc) : [];
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
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
            setNotice(error instanceof Error ? error.message : "Could not download the board."),
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
        setDraft(null);
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
        setDraft(null);
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
        setColumnDraft(null);
    }
    function removeColumn(): void {
        const stack = columnDraft?.stack;
        if (!editor || !stack || stack.cards.length || stack.pos === undefined) return;
        editor
            .chain()
            .deleteRange({ from: stack.pos, to: stack.endPos ?? editor.state.doc.content.size })
            .run();
        setColumnDraft(null);
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

    return (
        <div className="wm-task-view">
            <header className="wm-task-header">
                <KanbanIcon size={20} className="text-primary" aria-hidden="true" />
                <h1>{note.title || "Tasks"}</h1>
                <output className="wm-task-save">{status}</output>
                {actions}
                <div className="wm-task-view-switch" aria-label="Task view">
                    <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>
                        Board
                    </button>
                    <button type="button" aria-pressed={view === "markdown"} onClick={() => setView("markdown")}>
                        Markdown
                    </button>
                </div>
            </header>
            {notice ? (
                <aside role="alert" className="wm-task-notice">
                    <p>{notice}</p>
                    <Button onClick={() => save(latest.current)}>Retry</Button>
                    <Button theme="ghost-muted" onClick={download}>
                        Download local copy
                    </Button>
                </aside>
            ) : null}
            {view === "markdown" ? (
                <textarea
                    aria-label="Task Markdown"
                    className="wm-task-markdown"
                    value={markdown}
                    spellCheck={false}
                    onChange={(event) => {
                        const content = event.target.value;
                        setMarkdown(content);
                        editor?.commands.setContent(content, { emitUpdate: false });
                        save(content);
                    }}
                />
            ) : (
                <>
                    <div className="wm-task-toolbar">
                        <div className="wm-task-filters" aria-label="Task filters">
                            {(["active", "backlog", "all"] as const).map((value) => (
                                <button
                                    type="button"
                                    key={value}
                                    aria-pressed={filter === value}
                                    onClick={() => setFilter(value)}
                                >
                                    {value === "all" ? "All tasks" : value === "active" ? "Active" : "Backlog"}
                                </button>
                            ))}
                        </div>
                        <input
                            type="search"
                            aria-label="Search tasks"
                            placeholder="Search tasks..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <label className="wm-task-hide">
                            <input
                                type="checkbox"
                                checked={hideEmpty}
                                onChange={(event) => setHideEmpty(event.target.checked)}
                            />
                            Hide empty columns
                        </label>
                        <Button theme="ghost-muted" onClick={() => setColumnDraft({ title: "" })}>
                            <PlusIcon size={16} />
                            Add column
                        </Button>
                    </div>
                    <DndContext
                        sensors={sensors}
                        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                        collisionDetection={closestCorners}
                        onDragEnd={move}
                    >
                        <section className="wm-task-board" aria-label="Task board">
                            {shown.map(({ stack, cards }) => (
                                <Column
                                    key={`stack-${stack.pos}`}
                                    stack={stack}
                                    cards={cards}
                                    onRename={() => setColumnDraft({ stack, title: stack.title })}
                                    onAdd={() =>
                                        setDraft({
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
                                                setDraft({
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
                                <div className="wm-task-board-empty">
                                    <p>
                                        {stacks.length === 0
                                            ? "Add a column to start your task board."
                                            : "No tasks match this view."}
                                    </p>
                                    <Button
                                        theme="ghost-muted"
                                        onClick={() => {
                                            setSearch("");
                                            setFilter("all");
                                            setHideEmpty(false);
                                            if (!stacks.length) setColumnDraft({ title: "" });
                                        }}
                                    >
                                        {stacks.length === 0 ? "Add column" : "Show all columns"}
                                    </Button>
                                </div>
                            ) : null}
                        </section>
                    </DndContext>
                </>
            )}
            <Modal
                open={!!draft}
                onChange={() => setDraft(null)}
                title={draft?.card ? "Edit task" : "New task"}
                className="max-w-lg"
            >
                {draft ? (
                    <form
                        className="wm-task-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            commitTask();
                        }}
                    >
                        <label>
                            Title
                            <input
                                required
                                aria-label="Task title"
                                value={draft.title}
                                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            />
                        </label>
                        <label>
                            Description
                            <textarea
                                aria-label="Task description"
                                value={draft.description}
                                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                            />
                        </label>
                        <label>
                            Column
                            <select
                                aria-label="Task column"
                                value={draft.destination}
                                onChange={(event) => setDraft({ ...draft, destination: Number(event.target.value) })}
                            >
                                {stacks.map((stack, index) => (
                                    <option key={index} value={index}>
                                        {stack.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="wm-task-form-actions">
                            {draft.card ? (
                                <Button type="button" theme="ghost-muted" onClick={deleteTask}>
                                    Delete task
                                </Button>
                            ) : null}
                            <Button type="button" theme="ghost-muted" onClick={() => setDraft(null)}>
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
                onChange={() => setColumnDraft(null)}
                title={columnDraft?.stack ? "Edit column" : "New column"}
                className="max-w-md"
            >
                {columnDraft ? (
                    <form
                        className="wm-task-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            commitColumn();
                        }}
                    >
                        <label>
                            Column name
                            <input
                                required
                                aria-label="Column name"
                                value={columnDraft.title}
                                onChange={(event) => setColumnDraft({ ...columnDraft, title: event.target.value })}
                            />
                        </label>
                        <div className="wm-task-form-actions">
                            {columnDraft.stack && columnDraft.stack.cards.length === 0 ? (
                                <Button type="button" theme="ghost-muted" onClick={removeColumn}>
                                    Delete column
                                </Button>
                            ) : null}
                            <Button type="button" theme="ghost-muted" onClick={() => setColumnDraft(null)}>
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
                <div className="wm-task-form-actions">
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
