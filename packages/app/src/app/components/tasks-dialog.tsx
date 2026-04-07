import { editorGlobalRef } from "@/app/editor-global-ref";
import { useUIStore } from "@/store/ui.store";
import {
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    PointerSensor,
    closestCorners,
    defaultDropAnimationSideEffects,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Checkbox, Input, Modal } from "@g4rcez/components";
import { DotsSixVerticalIcon, PlusIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { type Node as ProseMirrorNode } from "prosemirror-model";
import {
    Fragment,
    type ReactNode,
    useCallback,
    useEffect,
    useState,
} from "react";

export type Card = {
  id: string;
  pos?: number;
  title: string;
  source: "task";
  endPos?: number;
  checked?: boolean;
  nodeSize?: number;
  titlePos?: number;
  description: string;
  descriptionPos?: number;
  parentTaskListPos?: number;
};

export type Stack = {
  title: string;
  cards: Card[];
  pos?: number;
  endPos?: number;
};

export function parseEditorTasks(doc: ProseMirrorNode): Stack[] {
  const stacks: Stack[] = [];
  let currentStack: Stack | null = null;
  let currentCard: Card | null = null;
  let awaitingDescription = false;

  let currentTaskListPos: number | undefined = undefined;

  const getOrCreateImplicitStack = (pos?: number): Stack => {
    if (!currentStack) {
      const implicit: Stack = { title: "Tasks", cards: [], pos: pos ?? 0 };
      stacks.push(implicit);
      currentStack = implicit;
    }
    return currentStack;
  };

  doc.descendants((node, pos): boolean | void => {
    if (node.type.name === "heading") {
      awaitingDescription = false;
      currentCard = null;
      currentTaskListPos = undefined;
      const level = node.attrs?.level ?? 1;
      const title = node.textContent;
      if (level === 1 || level === 2) {
        const stack: Stack = { title, cards: [], pos };
        stacks.push(stack);
        currentStack = stack;
      }
      return false;
    } else if (node.type.name === "paragraph") {
      if (awaitingDescription && currentCard) {
        currentCard.description = node.textContent;
        currentCard.descriptionPos = pos;
        currentCard.nodeSize = (currentCard.nodeSize ?? 0) + node.nodeSize;
        awaitingDescription = false;
      }
      return false;
    } else if (node.type.name === "taskList") {
      awaitingDescription = false;
      currentCard = null;
      currentTaskListPos = pos;
      return true;
    } else if (node.type.name === "taskItem") {
      const checked = node.attrs?.checked ?? false;
      const stack = getOrCreateImplicitStack(pos);
      let title = "";
      let titlePos = -1;
      node.forEach((child, offset) => {
        if (child.type.name === "paragraph" && title === "") {
          title = child.textContent;
          titlePos = pos + offset + 1; // +1 for the start of taskItem
        }
      });
      const card: Card = {
        id: String(pos),
        title,
        description: "",
        checked,
        pos,
        titlePos,
        nodeSize: node.nodeSize,
        parentTaskListPos: currentTaskListPos,
        source: "task",
      };
      stack.cards.push(card);
      currentCard = card;
      awaitingDescription = true;
      return false;
    } else {
      awaitingDescription = false;
    }
  });

  const filtered = stacks.filter(
    (s) => s.cards.length > 0 || (s.pos !== undefined && s.pos > 0),
  );

  for (let si = 0; si < filtered.length; si++) {
    const stack = filtered[si]!;
    const nextStack = filtered[si + 1];
    stack.endPos = nextStack?.pos ?? doc.content.size;

    for (const card of stack.cards) {
      if (card.pos !== undefined && card.nodeSize !== undefined) {
        card.endPos = card.pos + card.nodeSize;
      }
    }
  }

  return filtered;
}

// ---- ProseMirror reorder helpers ----

function findInsertPosForStack(
  doc: ProseMirrorNode,
  stack: Stack,
  insertBeforeCard?: Card,
): number {
  if (insertBeforeCard?.pos !== undefined) {
    return insertBeforeCard.pos;
  }

  let lastRelevantPos = -1;
  doc.nodesBetween(
    stack.pos ?? 0,
    stack.endPos ?? doc.content.size,
    (node, pos) => {
      if (node.type.name === "taskItem") {
        lastRelevantPos = pos + node.nodeSize;
      }
    },
  );

  if (lastRelevantPos !== -1) return lastRelevantPos;

  if (stack.pos !== undefined) {
    const headingNode = doc.nodeAt(stack.pos);
    let pos = stack.pos + (headingNode?.nodeSize ?? 0);
    const nextNode = doc.nodeAt(pos);
    if (nextNode && nextNode.type.name === "paragraph") {
      pos += nextNode.nodeSize;
    }
    return pos;
  }

  return doc.content.size;
}

export function moveTaskItemBetweenStacks(
  editor: NonNullable<typeof editorGlobalRef.current>,
  card: Card,
  targetStack: Stack,
  insertBeforeCard?: Card,
) {
  if (card.pos === undefined || card.endPos === undefined) return;

  editor
    .chain()
    .command(({ tr, state }) => {
      // Re-verify positions in current transaction state
      const slice = state.doc.slice(card.pos!, card.endPos!);
      const insertPos = findInsertPosForStack(
        state.doc,
        targetStack,
        insertBeforeCard,
      );

      let deleteFrom = card.pos!;
      let deleteTo = card.endPos!;
      if (card.parentTaskListPos !== undefined) {
        const taskListNode = state.doc.nodeAt(card.parentTaskListPos);
        if (taskListNode && taskListNode.childCount === 1) {
          deleteFrom = card.parentTaskListPos;
          deleteTo = card.parentTaskListPos + taskListNode.nodeSize;
        }
      }
      tr.delete(deleteFrom, deleteTo);
      const mappedInsertPos = tr.mapping.map(insertPos);

      const $insertPos = tr.doc.resolve(mappedInsertPos);
      const isInTaskList = $insertPos.parent.type.name === "taskList";

      if (isInTaskList) {
        tr.insert(mappedInsertPos, slice.content);
      } else {
        const firstNode = slice.content.firstChild;
        if (firstNode && firstNode.type.name === "taskItem") {
          const taskList = state.schema.nodes.taskList?.create(null, [
            firstNode,
          ]);
          if (taskList) tr.insert(mappedInsertPos, taskList);
          if (slice.content.childCount > 1) {
            tr.insert(
              mappedInsertPos + (taskList?.nodeSize ?? 0),
              slice.content.cut(firstNode.nodeSize),
            );
          }
        } else {
          tr.insert(mappedInsertPos, slice.content);
        }
      }
      return true;
    })
    .run();
}

export function updateTaskContent(
  editor: NonNullable<typeof editorGlobalRef.current>,
  card: Card,
  updates: { title?: string; description?: string },
) {
  editor
    .chain()
    .command(({ tr, state }) => {
      if (updates.title !== undefined && card.titlePos !== undefined) {
        const node = state.doc.nodeAt(card.titlePos);
        if (node && node.type.name === "paragraph") {
          tr.insertText(
            updates.title,
            card.titlePos + 1,
            card.titlePos + node.nodeSize - 1,
          );
        }
      }

      if (updates.description !== undefined) {
        if (card.descriptionPos !== undefined) {
          const node = state.doc.nodeAt(card.descriptionPos);
          if (node && node.type.name === "paragraph") {
            const mappedDescPos = tr.mapping.map(card.descriptionPos);
            tr.insertText(
              updates.description,
              mappedDescPos + 1,
              mappedDescPos + node.nodeSize - 1,
            );
          }
        } else {
          const descriptionNode = state.schema.nodes.paragraph?.create(
            null,
            state.schema.text(updates.description),
          );
          const insertPos = card.endPos ?? card.pos! + (card.nodeSize ?? 0);
          if (descriptionNode)
            tr.insert(tr.mapping.map(insertPos), descriptionNode);
        }
      }
      return true;
    })
    .run();
}

export function addTaskToStack(
  editor: NonNullable<typeof editorGlobalRef.current>,
  stack: Stack,
  task: { title: string; description?: string },
) {
  editor
    .chain()
    .command(({ tr, state }) => {
      const taskItem = state.schema.nodes.taskItem?.create(
        { checked: false },
        state.schema.nodes.paragraph?.create(
          null,
          state.schema.text(task.title),
        ),
      );
      const insertPos = findInsertPosForStack(state.doc, stack);
      const $insertPos = state.doc.resolve(insertPos);
      const isInTaskList = $insertPos.parent.type.name === "taskList";
      if (isInTaskList && taskItem) {
        tr.insert(insertPos, taskItem);
      } else {
        const taskList = state.schema.nodes.taskList?.create(null, taskItem);
        if (taskList) tr.insert(insertPos, taskList);
      }

      if (task.description) {
        const descPos = tr.mapping.map(insertPos) + (taskItem?.nodeSize ?? 0);
        const descriptionNode = state.schema.nodes.paragraph?.create(
          null,
          state.schema.text(task.description),
        );
        if (descriptionNode) tr.insert(descPos, descriptionNode);
      }
      return true;
    })
    .run();
}

type NewTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: { title: string; description: string }) => void;
  stackTitle: string;
};

const NewTaskModal = ({
  isOpen,
  onClose,
  onAdd,
  stackTitle,
}: NewTaskModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({ title, description });
    setTitle("");
    setDescription("");
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onChange={onClose}
      title={`Add task to "${stackTitle}"`}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <Input
          autoFocus
          hiddenLabel
          title="Title"
          value={title}
          placeholder="What needs to be done?"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button theme="ghost-muted" onClick={onClose}>
            Cancel
          </Button>
          <Button theme="primary" onClick={handleAdd} disabled={!title.trim()}>
            Add Task
          </Button>
        </div>
      </div>
    </Modal>
  );
};

type TaskCardProps = {
  card: Card;
  onToggle?: (card: Card) => void;
  onUpdate?: (
    card: Card,
    updates: { title?: string; description?: string },
  ) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
};

const TaskCard = ({
  card,
  onToggle,
  onUpdate,
  isDragging,
  isOverlay,
}: TaskCardProps) => {
  const [editingField, setEditingField] = useState<
    "title" | "description" | null
  >(null);
  const [tempTitle, setTitle] = useState(card.title);
  const [tempDesc, setDescription] = useState(card.description);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
  }, [card.title, card.description]);

  const handleSave = () => {
    if (editingField === "title" && tempTitle !== card.title) {
      onUpdate?.(card, { title: tempTitle });
    } else if (
      editingField === "description" &&
      tempDesc !== card.description
    ) {
      onUpdate?.(card, { description: tempDesc });
    }
    setEditingField(null);
  };

  return (
    <div
      className={`group flex flex-col gap-1 p-3 rounded-lg border border-floating-border bg-floating shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? "opacity-0" : ""
      } ${isOverlay ? "shadow-xl ring-2 ring-primary/20" : ""}`}
    >
      <div className="flex gap-2 items-start">
        <div className="mt-1 shrink-0 opacity-40 group-hover:opacity-70 transition-opacity">
          <DotsSixVerticalIcon className="size-4" />
        </div>
        {!isOverlay && (
          <Checkbox
            checked={!!card.checked}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={() => onToggle?.(card)}
          />
        )}
        <div
          className="flex-1 min-w-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {editingField === "title" ? (
            <Input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setTitle(card.title);
                  setEditingField(null);
                }
              }}
              className="h-7 text-sm py-0"
            />
          ) : (
            <span
              onClick={() => setEditingField("title")}
              className={`text-sm font-medium leading-snug break-words cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-1 -mx-1 transition-colors ${
                card.checked
                  ? "line-through text-foreground/50"
                  : "text-foreground"
              }`}
            >
              {card.title || "Untitled Task"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

type SortableCardProps = {
  card: Card;
  onToggle: (card: Card) => void;
  onUpdate: (
    card: Card,
    updates: { title?: string; description?: string },
  ) => void;
};

function SortableCard({ card, onToggle, onUpdate }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        card={card}
        onToggle={onToggle}
        onUpdate={onUpdate}
        isDragging={isDragging}
      />
    </div>
  );
}

type DroppableColumnProps = {
  stack: Stack;
  index: number;
  activeId: string | null;
  overColumnIndex: number | null;
  activeColumnIndex: number | null;
  onAddTask: (stack: Stack) => void;
  children: ReactNode;
};

function DroppableColumn({ stack, onAddTask, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stack-${stack.pos}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 flex flex-col gap-3 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/30 p-4 transition-all duration-300 ${
        isOver
          ? "ring-2 ring-primary/40 bg-primary/5 shadow-inner"
          : "ring-1 ring-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 truncate">
            {stack.title}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
              isOver
                ? "bg-primary text-primary-foreground"
                : "bg-neutral-200/50 dark:bg-neutral-700/50 text-foreground/50"
            }`}
          >
            {stack.cards.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(stack)}
          className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-foreground/50 transition-colors"
          title="Add task"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>
      <SortableContext
        id={`stack-${stack.pos}`}
        items={stack.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 min-h-[150px]">
          {children}
          <AnimatePresence propagate>
            {stack.cards.length === 0 && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl transition-all duration-300 ${
                  isOver
                    ? "border-primary bg-primary/10 text-primary scale-[0.98]"
                    : "border-neutral-200 dark:border-neutral-700 text-foreground/20"
                }`}
              >
                <motion.div
                  animate={isOver ? { y: [0, -4, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`p-2 rounded-full mb-2 transition-colors ${
                    isOver
                      ? "bg-primary/20"
                      : "bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  <DotsSixVerticalIcon className="size-5" />
                </motion.div>
                <span className="text-bold text-[10px] uppercase tracking-widest text-center px-4">
                  {isOver ? "Release to drop" : "Empty Column"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SortableContext>
    </div>
  );
}

export const TasksDialog = () => {
  const [uiState, uiDispatch] = useUIStore();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [newTaskStack, setNewTaskStack] = useState<Stack | null>(null);
  const [x, setX] = useState(0);

  const onClose = () => {
    uiDispatch.closeTasksDialog();
    setX((prev) => prev + 1);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const findCardLocation = useCallback(
    (id: string, currentStacks = stacks): { si: number; ci: number } | null => {
      for (let si = 0; si < currentStacks.length; si++) {
        const ci = currentStacks[si]!.cards.findIndex((c) => c.id === id);
        if (ci !== -1) return { si, ci };
      }
      return null;
    },
    [stacks],
  );

  useEffect(() => {
    const editor = editorGlobalRef.current;
    if (!editor || !uiState.tasksDialog.isOpen) return;

    const handleSync = () => {
      setStacks(parseEditorTasks(editor.state.doc));
    };

    editor.on("update", handleSync);
    handleSync(); // Initial load

    return () => {
      editor.off("update", handleSync);
    };
  }, [uiState.tasksDialog.isOpen]);

  const toggleTask = (card: Card) => {
    const editor = editorGlobalRef.current;
    if (!editor || card.pos === undefined) return;
    const pos = card.pos;
    const newChecked = !card.checked;
    editor
      .chain()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node || node.type.name !== "taskItem") return false;
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          checked: newChecked,
        });
        return true;
      })
      .run();
  };

  const handleUpdateTask = (
    card: Card,
    updates: { title?: string; description?: string },
  ) => {
    if (editorGlobalRef.current) {
      updateTaskContent(editorGlobalRef.current, card, updates);
    }
  };

  const handleAddNewTask = (task: { title: string; description: string }) => {
    if (editorGlobalRef.current && newTaskStack) {
      addTaskToStack(editorGlobalRef.current, newTaskStack, task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeLoc = findCardLocation(activeId);
    if (!activeLoc) return;

    const overLoc = findCardLocation(overId);
    const overStackIndex = stacks.findIndex((s) => `stack-${s.pos}` === overId);

    if (overLoc && activeLoc.si !== overLoc.si) {
      setStacks((prev) => {
        const currentActiveLoc = findCardLocation(activeId, prev);
        const currentOverLoc = findCardLocation(overId, prev);
        if (!currentActiveLoc || !currentOverLoc) return prev;

        const newStacks = [...prev];
        const activeStack = { ...newStacks[currentActiveLoc.si]! };
        const overStack = { ...newStacks[currentOverLoc.si]! };

        const [movedCard] = activeStack.cards.splice(currentActiveLoc.ci, 1);
        if (!movedCard) return prev;

        overStack.cards.splice(currentOverLoc.ci, 0, movedCard);

        newStacks[currentActiveLoc.si] = activeStack;
        newStacks[currentOverLoc.si] = overStack;
        return newStacks;
      });
    } else if (overStackIndex !== -1 && activeLoc.si !== overStackIndex) {
      setStacks((prev) => {
        const currentActiveLoc = findCardLocation(activeId, prev);
        if (!currentActiveLoc) return prev;
        const newStacks = Array.from(prev);
        const activeStack = { ...newStacks[currentActiveLoc.si]! };
        const overStack = { ...newStacks[overStackIndex]! };
        const [movedCard] = activeStack.cards.splice(currentActiveLoc.ci, 1);
        if (!movedCard) return prev;
        overStack.cards.push(movedCard);
        newStacks[currentActiveLoc.si] = activeStack;
        newStacks[overStackIndex] = overStack;
        return newStacks;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    const editor = editorGlobalRef.current;
    if (!editor) return;

    if (!over) {
      setStacks(parseEditorTasks(editor.state.doc));
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeLoc = findCardLocation(activeId, stacks);
    if (!activeLoc) return;

    let finalLocInUI = { ...activeLoc };
    let targetStackInUI = { ...stacks[activeLoc.si]! };

    const overLoc = findCardLocation(overId, stacks);

    if (overLoc && activeLoc.si === overLoc.si && activeLoc.ci !== overLoc.ci) {
      const newCards = [...targetStackInUI.cards];
      const [moved] = newCards.splice(activeLoc.ci, 1);
      if (moved) {
        newCards.splice(overLoc.ci, 0, moved);
        targetStackInUI.cards = newCards;
        finalLocInUI.ci = overLoc.ci;
      }
    }

    // Use current document state for final commit
    const docStacks = parseEditorTasks(editor.state.doc);
    const originalCardLoc = findCardLocation(activeId, docStacks);
    if (!originalCardLoc) {
      setStacks(docStacks);
      return;
    }

    if (
      originalCardLoc.si === finalLocInUI.si &&
      originalCardLoc.ci === finalLocInUI.ci
    ) {
      setStacks(docStacks);
      return;
    }

    const srcCard = docStacks[originalCardLoc.si]!.cards[originalCardLoc.ci]!;

    let insertBeforeCardInDoc: Card | undefined;
    for (let i = finalLocInUI.ci + 1; i < targetStackInUI.cards.length; i++) {
      const cardId = targetStackInUI.cards[i]!.id;
      const found = findCardLocation(cardId, docStacks);
      if (found) {
        insertBeforeCardInDoc = docStacks[found.si]!.cards[found.ci];
        break;
      }
    }

    const targetStackInDoc = docStacks[finalLocInUI.si]!;
    moveTaskItemBetweenStacks(
      editor,
      srcCard,
      targetStackInDoc,
      insertBeforeCardInDoc,
    );
  };

  const getActiveCard = () => {
    if (!activeId) return null;
    const loc = findCardLocation(activeId);
    return loc ? stacks[loc.si]!.cards[loc.ci] : null;
  };

  const getOverColumnIndex = (id: string | null) => {
    if (!id) return null;
    const loc = findCardLocation(id);
    if (loc) return loc.si;
    return stacks.findIndex((s) => `stack-${s.pos}` === id);
  };

  const activeColumnIndex = getOverColumnIndex(activeId);
  const overColumnIndex = getOverColumnIndex(overId);

  return (
    <Fragment>
      <Modal
        onChange={onClose}
        title="Note Tasks"
        key={`tasks-dialog-${x}`}
        open={uiState.tasksDialog.isOpen}
        className="max-w-6xl min-h-[70vh]"
      >
        <AnimatePresence propagate>
          {stacks.length === 0 ? (
            <p className="py-8 text-sm text-center text-disabled">
              No tasks found. Add headings or{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
                {"[ ]"}
              </code>{" "}
              checkboxes to your note.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(e) => setActiveId(String(e.active.id))}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setActiveId(null);
                setOverId(null);
                if (editorGlobalRef.current) {
                  setStacks(
                    parseEditorTasks(editorGlobalRef.current.state.doc),
                  );
                }
              }}
            >
              <AnimatePresence propagate>
                <div className="flex overflow-x-auto gap-4 pb-4 items-start scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700">
                  {stacks.map((stack, si) => (
                    <motion.div
                      layout
                      key={`stack-${stack.pos}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DroppableColumn
                        stack={stack}
                        index={si}
                        activeId={activeId}
                        overColumnIndex={overColumnIndex}
                        activeColumnIndex={activeColumnIndex}
                        onAddTask={setNewTaskStack}
                      >
                        {stack.cards.map((card) => (
                          <SortableCard
                            key={card.id}
                            card={card}
                            onToggle={toggleTask}
                            onUpdate={handleUpdateTask}
                          />
                        ))}
                      </DroppableColumn>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
              <DragOverlay
                dropAnimation={{
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: { active: { opacity: "0.5" } },
                  }),
                }}
              >
                {activeId && getActiveCard() ? (
                  <TaskCard card={getActiveCard()!} isOverlay />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </AnimatePresence>
      </Modal>
      <NewTaskModal
        isOpen={!!newTaskStack}
        onClose={() => setNewTaskStack(null)}
        onAdd={handleAddNewTask}
        stackTitle={newTaskStack?.title ?? ""}
      />
    </Fragment>
  );
};
