import { Checkbox, Modal } from "@g4rcez/components";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";
import { Fragment } from "prosemirror-model";
import { type Node as ProseMirrorNode } from "prosemirror-model";
import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { useUIStore } from "@/store/ui.store";

type Card = {
  id: string;
  title: string;
  description: string;
  checked?: boolean;
  pos?: number;
  endPos?: number;
  nodeSize?: number;
  parentTaskListPos?: number;
  source: "task";
};

type Stack = {
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
      node.forEach((child) => {
        if (child.type.name === "paragraph" && title === "") {
          title = child.textContent;
        }
      });
      const card: Card = {
        id: String(pos),
        title,
        description: "",
        checked,
        pos,
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

  const filtered = stacks.filter((s) => s.cards.length > 0 || (s.pos !== undefined && s.pos > 0));

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

function reorderTasksInStack(
  editor: NonNullable<typeof editorGlobalRef.current>,
  cards: Card[],
) {
  if (cards.length === 0 || cards[0]?.pos === undefined) return;
  const { state } = editor;
  const resolved = state.doc.resolve(cards[0]!.pos!);
  const taskListNode = resolved.parent;
  const taskListStart = resolved.before();
  const taskListEnd = taskListStart + taskListNode.nodeSize;

  const newChildren: ProseMirrorNode[] = [];
  for (const card of cards) {
    if (card.pos === undefined) continue;
    const node = state.doc.nodeAt(card.pos);
    if (node) newChildren.push(node);
  }

  const newFragment = Fragment.fromArray(newChildren);
  const tr = state.tr.replaceWith(taskListStart + 1, taskListEnd - 1, newFragment);
  editor.view.dispatch(tr);
}

function moveTaskItemBetweenStacks(
  editor: NonNullable<typeof editorGlobalRef.current>,
  card: Card,
  targetStack: Stack,
  insertBeforeCard?: Card,
) {
  if (card.pos === undefined || card.nodeSize === undefined) return;
  const { state } = editor;
  const node = state.doc.nodeAt(card.pos);
  if (!node || node.type.name !== "taskItem") return;

  const tr = state.tr;
  let insertPos: number;

  if (insertBeforeCard?.pos !== undefined) {
    insertPos = insertBeforeCard.pos;
  } else {
    // Find last taskItem in this stack's range in the doc
    let lastTaskItemEnd = -1;
    state.doc.nodesBetween(targetStack.pos ?? 0, targetStack.endPos ?? state.doc.content.size, (node, pos) => {
      if (node.type.name === "taskItem") {
        lastTaskItemEnd = pos + node.nodeSize;
      }
    });

    if (lastTaskItemEnd !== -1) {
      insertPos = lastTaskItemEnd;
    } else {
      let taskListPos = -1;
      state.doc.nodesBetween(targetStack.pos ?? 0, targetStack.endPos ?? state.doc.content.size, (node, pos) => {
        if (node.type.name === "taskList") {
          taskListPos = pos;
          return false;
        }
      });

      if (taskListPos !== -1) {
        insertPos = taskListPos + 1;
      } else {
        if (targetStack.pos !== undefined) {
          const headingNode = state.doc.nodeAt(targetStack.pos);
          insertPos = targetStack.pos + (headingNode?.nodeSize ?? 0);
          const nextNode = state.doc.nodeAt(insertPos);
          if (nextNode && nextNode.type.name === "paragraph") {
            insertPos += nextNode.nodeSize;
          }
        } else {
          insertPos = state.doc.content.size;
        }
      }
    }
  }

  const $insertPos = state.doc.resolve(insertPos);
  const isInTaskList = $insertPos.parent.type.name === "taskList";

  if (isInTaskList) {
    tr.insert(insertPos, node);
  } else {
    const taskList = state.schema.nodes.taskList.create(null, node);
    tr.insert(insertPos, taskList);
  }

  const cardPos = tr.mapping.map(card.pos);
  const cardEnd = tr.mapping.map(card.pos + card.nodeSize);
  tr.delete(cardPos, cardEnd);

  editor.view.dispatch(tr);
}

// ---- Presentational TaskCard ----

type TaskCardProps = {
  card: Card;
  onToggle?: (card: Card) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
};

const TaskCard = ({ card, onToggle, isDragging, isOverlay }: TaskCardProps) => {
  return (
    <div
      className={`group flex flex-col gap-1 p-3 rounded-lg border border-floating-border bg-floating shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? "opacity-20 border-dashed" : ""
      } ${isOverlay ? "shadow-xl ring-2 ring-primary/20" : ""}`}
    >
      <div className="flex gap-2 items-start">
        <div className="mt-1 shrink-0 opacity-40 group-hover:opacity-70 transition-opacity">
          <DotsSixVertical className="size-4" />
        </div>
        <Checkbox
          checked={!!card.checked}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={() => onToggle?.(card)}
        />
        <span
          className={`text-sm font-medium leading-snug ${
            card.checked ? "line-through text-foreground/50" : "text-foreground"
          }`}
        >
          {card.title}
        </span>
      </div>
      {card.description && (
        <p className="ml-6 text-xs text-foreground/60 line-clamp-3">
          {card.description}
        </p>
      )}
    </div>
  );
};

// ---- SortableCard component ----

type SortableCardProps = {
  card: Card;
  onToggle: (card: Card) => void;
};

function SortableCard({ card, onToggle }: SortableCardProps) {
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard card={card} onToggle={onToggle} isDragging={isDragging} />
    </div>
  );
}

// ---- Droppable Column component ----

type DroppableColumnProps = {
  stack: Stack;
  index: number;
  activeId: string | null;
  overColumnIndex: number | null;
  activeColumnIndex: number | null;
  children: ReactNode;
};

function DroppableColumn({
  stack,
  index,
  activeId,
  overColumnIndex,
  activeColumnIndex,
  children,
}: DroppableColumnProps) {
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
      <SortableContext
        id={`stack-${stack.pos}`}
        items={stack.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 min-h-[150px]">
          <AnimatePresence mode="popLayout" initial={false}>
            {children}
          </AnimatePresence>
          {stack.cards.length === 0 && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
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
                  isOver ? "bg-primary/20" : "bg-neutral-100 dark:bg-neutral-800"
                }`}
              >
                <DotsSixVertical className="size-5" />
              </motion.div>
              <span className="text-bold text-[10px] uppercase tracking-widest text-center px-4">
                {isOver ? "Release to drop" : "Empty Column"}
              </span>
            </motion.div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ---- Main dialog ----

export const TasksDialog = () => {
  const [uiState, uiDispatch] = useUIStore();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const onClose = () => uiDispatch.closeTasksDialog();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    if (uiState.tasksDialog.isOpen && editorGlobalRef.current) {
      setStacks(parseEditorTasks(editorGlobalRef.current.state.doc));
    }
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
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: newChecked });
        return true;
      })
      .run();
    setStacks(parseEditorTasks(editor.state.doc));
  };

  const findCardLocation = (
    id: string,
    currentStacks = stacks,
  ): { si: number; ci: number } | null => {
    for (let si = 0; si < currentStacks.length; si++) {
      const ci = currentStacks[si]!.cards.findIndex((c) => c.id === id);
      if (ci !== -1) return { si, ci };
    }
    return null;
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

        const newStacks = [...prev];
        const activeStack = { ...newStacks[currentActiveLoc.si]! };
        const overStack = { ...newStacks[overStackIndex]! };

        const [movedCard] = activeStack.cards.splice(currentActiveLoc.ci, 1);
        if (!movedCard) return prev;

        overStack.cards.push(movedCard);

        newStacks[currentActiveLoc.si] = activeStack;
        newStacks[overStackIndex] = overStack;
        return newStacks;
      });
    } else if (overLoc && activeLoc.si === overLoc.si && activeLoc.ci !== overLoc.ci) {
      setStacks((prev) => {
        const currentActiveLoc = findCardLocation(activeId, prev);
        const currentOverLoc = findCardLocation(overId, prev);
        if (!currentActiveLoc || !currentOverLoc) return prev;

        const newStacks = [...prev];
        const stack = { ...newStacks[currentActiveLoc.si]! };
        const [movedCard] = stack.cards.splice(currentActiveLoc.ci, 1);
        if (!movedCard) return prev;
        stack.cards.splice(currentOverLoc.ci, 0, movedCard);
        newStacks[currentActiveLoc.si] = stack;
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
    const finalLocInUI = findCardLocation(activeId, stacks);
    if (!finalLocInUI) return;

    const originalDocStacks = parseEditorTasks(editor.state.doc);
    const originalCardLoc = findCardLocation(activeId, originalDocStacks);
    if (!originalCardLoc) {
      setStacks(parseEditorTasks(editor.state.doc));
      return;
    }

    const srcCard = originalDocStacks[originalCardLoc.si]?.cards[originalCardLoc.ci];
    if (!srcCard) return;

    const targetStackInUI = stacks[finalLocInUI.si]!;

    let insertBeforeCardInDoc: Card | undefined;
    for (let i = finalLocInUI.ci + 1; i < targetStackInUI.cards.length; i++) {
      const uiCard = targetStackInUI.cards[i]!;
      const docCardLoc = findCardLocation(uiCard.id, originalDocStacks);
      if (docCardLoc) {
        insertBeforeCardInDoc = originalDocStacks[docCardLoc.si]?.cards[docCardLoc.ci];
        break;
      }
    }

    const targetStackInDoc = originalDocStacks[finalLocInUI.si];

    if (targetStackInDoc) {
      moveTaskItemBetweenStacks(editor, srcCard, targetStackInDoc, insertBeforeCardInDoc);
    }

    setStacks(parseEditorTasks(editor.state.doc));
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
    <Modal
      onChange={onClose}
      title="Note Tasks"
      className="max-w-6xl min-h-[70vh]"
      open={uiState.tasksDialog.isOpen}
    >
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
              setStacks(parseEditorTasks(editorGlobalRef.current.state.doc));
            }
          }}
        >
          <div className="flex overflow-x-auto gap-4 pb-4 items-start scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700">
            <AnimatePresence mode="popLayout" initial={false}>
              {stacks.map((stack, si) => (
                <motion.div
                  layout
                  key={`stack-${stack.pos}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <DroppableColumn
                    stack={stack}
                    index={si}
                    activeId={activeId}
                    overColumnIndex={overColumnIndex}
                    activeColumnIndex={activeColumnIndex}
                  >
                    {stack.cards.map((card) => (
                      <SortableCard
                        key={card.id}
                        card={card}
                        onToggle={toggleTask}
                      />
                    ))}
                  </DroppableColumn>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
            {activeId && getActiveCard() ? (
              <TaskCard card={getActiveCard()!} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </Modal>
  );
};