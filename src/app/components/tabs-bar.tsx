import type React from "react";
import { css } from "@g4rcez/components";
import { ChatCircleDotsIcon, FileTextIcon, TerminalIcon } from "@phosphor-icons/react";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GlobalDispatchers } from "@/store/global.store";
import type { Tab } from "@/store/repositories/entities/tab";
import type { TerminalSession } from "@/store/repositories/entities/terminal-session";
import { suppressNoteRouteTabOpen } from "@/lib/note-route-tab-open-suppression";
import { getPreviousTabAfterClose } from "@/lib/tab-closing";
import {
    getCurrentRouteTabTarget,
    getRouteForTab,
    getTabTarget,
    isAiChatTab,
    isSameTabTarget,
    isTerminalTab,
} from "@/lib/tab-target";
import { Note } from "@/store/note";
import { uiDispatch } from "@/store/ui.store";
import { useAiChatTabs } from "../hooks/use-ai-chat-tabs";
import { useNoteTabs } from "../hooks/use-note-tabs";

type Props = {
    tabs: Tab[];
    notes: Note[];
    directory: string | null;
    activeTabId: string | null;
    terminalSessions: TerminalSession[];
    dispatch: GlobalDispatchers;
};

type RenamingTarget = {
    type: "note" | "terminal";
    id: string;
};

const isSameRenamingTarget = (a: RenamingTarget | null, b: RenamingTarget): boolean =>
    a?.type === b.type && a.id === b.id;

export const TabsBar = (props: Props) => {
    const dispatch = props.dispatch;
    const navigate = useNavigate();
    const location = useLocation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [renamingTarget, setRenamingTarget] = useState<RenamingTarget | null>(null);
    const [renamingValue, setRenamingValue] = useState("");
    const renameEscapedRef = useRef(false);
    const renameCommittedRef = useRef(false);
    const notesById = useNoteTabs(props.notes);
    const chatsById = useAiChatTabs(props.directory, props.tabs);
    const terminalSessionsById = useMemo(
        () => new Map(props.terminalSessions.map((session) => [session.id, session])),
        [props.terminalSessions],
    );
    const currentTarget = useMemo(
        () => getCurrentRouteTabTarget(location.pathname, location.search),
        [location.pathname, location.search],
    );

    const navigateToTab = async (tab: Tab): Promise<void> => {
        const target = getTabTarget(tab);
        if (target.type === "note") {
            await dispatch.selectNoteById(target.id);
        } else if (target.type === "ai-chat") {
            await dispatch.addAiChatTab(target.id);
        } else {
            await dispatch.addTerminalTab(target.id);
        }
        navigate(getRouteForTab(tab));
    };

    const isCurrentTab = (tab: Tab): boolean => {
        if (currentTarget) {
            return isSameTabTarget(getTabTarget(tab), currentTarget);
        }
        return props.activeTabId === tab.id;
    };

    const getTabTitle = (tab: Tab): string => {
        if (isTerminalTab(tab)) {
            return terminalSessionsById.get(tab.noteId)?.title?.trim() || "Terminal";
        }
        if (isAiChatTab(tab)) {
            return chatsById.get(tab.noteId)?.title?.trim() || "AI Chat";
        }
        return notesById.get(tab.noteId)?.title || "Untitled";
    };

    const closeTab = async (tab: Tab): Promise<void> => {
        const isClosingCurrentTab = isCurrentTab(tab);
        const nextTab = getPreviousTabAfterClose(props.tabs, tab.id);
        if (isClosingCurrentTab && !isAiChatTab(tab) && !isTerminalTab(tab)) {
            suppressNoteRouteTabOpen(tab.noteId);
        }

        if (!isClosingCurrentTab) {
            await dispatch.removeTab(tab.id);
            return;
        }

        if (nextTab) {
            await navigateToTab(nextTab);
            await dispatch.removeTab(tab.id);
            return;
        }

        dispatch.activeTabId(null);
        navigate("/", { replace: true });
        await dispatch.removeTab(tab.id);
    };

    const onCloseTab = async (e: React.MouseEvent, tab: Tab) => {
        e.stopPropagation();
        e.preventDefault();
        if (!isTerminalTab(tab)) {
            await closeTab(tab);
            return;
        }

        const title = getTabTitle(tab);
        uiDispatch.setConfirm({
            open: true,
            type: "danger",
            title: `Close ${title}?`,
            message: `Closing terminal "${title}" will kill its running shell session.`,
            confirmText: "Close Terminal",
            onConfirm: () => {
                uiDispatch.clearConfirm();
                void closeTab(tab);
            },
            onCancel: () => uiDispatch.clearConfirm(),
        });
    };

    const onMiddleClick = (e: React.MouseEvent, tab: Tab) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button === 1) {
            void onCloseTab(e, tab);
        }
    };

    const commitRename = async (target: RenamingTarget) => {
        if (renameEscapedRef.current) {
            renameEscapedRef.current = false;
            setRenamingTarget(null);
            return;
        }
        if (renameCommittedRef.current) return;
        renameCommittedRef.current = true;
        const trimmed = renamingValue.trim();

        if (target.type === "terminal") {
            const session = terminalSessionsById.get(target.id);
            if (trimmed && trimmed !== session?.title) {
                await dispatch.renameTerminalSession(target.id, trimmed);
            }
            renameCommittedRef.current = false;
            setRenamingTarget(null);
            return;
        }

        const note = notesById.get(target.id);
        if (!note) {
            renameCommittedRef.current = false;
            setRenamingTarget(null);
            return;
        }
        if (trimmed && trimmed !== note.title) {
            const parsed = Note.parse(note);
            parsed.setTitle(trimmed);
            await dispatch.note(parsed);
        }
        renameCommittedRef.current = false;
        setRenamingTarget(null);
    };

    useEffect(() => {
        if (props.activeTabId && scrollRef.current) {
            const activeElement = scrollRef.current.querySelector(`[data-tab-id="${props.activeTabId}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest",
                });
            }
        }
    }, [props.activeTabId]);

    return (
        <div className="writeme-tabs-bar">
            <div ref={scrollRef} className="writeme-tabs-bar-list tab-scrollbar select-none">
                {props.tabs.map((tab: Tab) => {
                    const isChatTab = isAiChatTab(tab);
                    const isTerminal = isTerminalTab(tab);
                    const note = isChatTab || isTerminal ? undefined : notesById.get(tab.noteId);
                    const isActive = isCurrentTab(tab);
                    const title = getTabTitle(tab);
                    const tabTitle = isTerminal ? title : isChatTab ? title : note?.filePath || title;
                    const renameTarget: RenamingTarget | null = isTerminal
                        ? { type: "terminal", id: tab.noteId }
                        : isChatTab
                          ? null
                          : { type: "note", id: tab.noteId };
                    const isRenaming = renameTarget ? isSameRenamingTarget(renamingTarget, renameTarget) : false;
                    return (
                        <Link
                            key={tab.id}
                            data-tab-id={tab.id}
                            title={tabTitle}
                            to={getRouteForTab(tab)}
                            onMouseDown={(e) => onMiddleClick(e, tab)}
                            onClick={(e) => {
                                if (isRenaming) {
                                    e.preventDefault();
                                }
                            }}
                            aria-current={isActive ? "page" : undefined}
                            className={css(
                                "group relative flex h-full min-w-28 max-w-xs items-center gap-1.5 border-r border-border/40 px-3",
                                "cursor-pointer transition-[background-color,color] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                                isActive
                                    ? "bg-muted/50 text-foreground"
                                    : "bg-transparent text-foreground/55 hover:bg-muted/30 hover:text-foreground",
                            )}
                        >
                            {isTerminal ? (
                                <TerminalIcon size={13} className="shrink-0 opacity-70" aria-hidden="true" />
                            ) : isChatTab ? (
                                <ChatCircleDotsIcon size={13} className="shrink-0 opacity-70" aria-hidden="true" />
                            ) : (
                                <FileTextIcon size={13} className="shrink-0 opacity-70" aria-hidden="true" />
                            )}
                            {renameTarget && isRenaming ? (
                                <input
                                    autoFocus
                                    value={renamingValue}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() => void commitRename(renameTarget)}
                                    onChange={(e) => setRenamingValue(e.target.value)}
                                    className="flex-1 text-xs bg-transparent outline-none min-w-0"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            commitRename(renameTarget);
                                        }
                                        if (e.key === "Escape") {
                                            e.stopPropagation();
                                            renameEscapedRef.current = true;
                                            (e.target as HTMLInputElement).blur();
                                        }
                                    }}
                                />
                            ) : (
                                <span
                                    className="flex-1 text-xs truncate"
                                    tabIndex={renameTarget ? 0 : undefined}
                                    onDoubleClick={(e) => {
                                        if (!renameTarget) return;
                                        e.preventDefault();
                                        renameCommittedRef.current = false;
                                        setRenamingTarget(renameTarget);
                                        setRenamingValue(title);
                                    }}
                                    onKeyDown={(e) => {
                                        if (!renameTarget) return;
                                        if (e.key === "Enter" || e.key === "F2") {
                                            e.preventDefault();
                                            renameCommittedRef.current = false;
                                            setRenamingTarget(renameTarget);
                                            setRenamingValue(title);
                                        }
                                    }}
                                >
                                    {title}
                                </span>
                            )}
                            <button
                                type="button"
                                aria-label={`Close ${title}`}
                                onClick={(e) => void onCloseTab(e, tab)}
                                className={css(
                                    "flex size-7 shrink-0 items-center justify-center rounded-md transition-[background-color,opacity] hover:bg-foreground/10",
                                    isActive
                                        ? "opacity-60 group-hover:opacity-100"
                                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                                )}
                            >
                                <XIcon className="size-2.5" />
                            </button>
                            {isActive && <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />}
                        </Link>
                    );
                })}
            </div>
            <button
                type="button"
                className="writeme-tabs-bar-new"
                aria-label="New note"
                title="New note (⌘N)"
                onClick={() => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" })}
            >
                <PlusIcon size={16} aria-hidden="true" />
            </button>
        </div>
    );
};
