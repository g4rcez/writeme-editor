import { useNotification } from "@g4rcez/components";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { Fragment, Suspense, useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AIDrawer } from "@/app/ai/ai-drawer";
import { createWorkspaceAiChat } from "@/app/ai/create-ai-chat";
import { Commander } from "@/app/commander";
import { AddToGroupDialog } from "@/app/components/add-to-group-dialog";
import { Alert } from "@/app/components/alert";
import { Confirm } from "@/app/components/confirm";
import { CreateNoteDialog } from "@/app/components/create-note-dialog";
import { CreateTemplateDialog } from "@/app/components/create-template-dialog";
import { CreateVariableDialog } from "@/app/components/create-variable-dialog";
import { DirectoryBrowserDialog } from "@/app/components/directory-browser-dialog";
import { FindReplaceBar } from "@/app/components/find-replace-bar";
import { GitSyncDialog } from "@/app/components/git-sync-dialog";
import { InspectJsonDialog } from "@/app/components/inspect-json-dialog";
import { KeyboardClickHints } from "@/app/components/keyboard-click-hints";
import { MediaPreview } from "@/app/components/media-preview";
import { Prompt } from "@/app/components/prompt";
import { ReadItLaterDialog } from "@/app/components/read-it-later-dialog";
import { RecentNotesDialog } from "@/app/components/recent-notes-dialog";
import { TasksDialog } from "@/app/components/tasks-dialog";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { usePwaUpdate } from "@/app/hooks/use-pwa-update";
import { MainLayout } from "@/app/layouts/main.layout";
import { migrateWebOnlyNotesToDirectory } from "@/app/lib/open-directory-as-workspace";
import { notificationRef } from "@/app/notification-ref";
import { registerHotkeys } from "@/lib/hotkeys";
import { isElectron } from "@/lib/is-electron";
import { getTabNavigationHotkey, type TabNavigationShortcut } from "@/lib/keyboard-shortcuts";
import { clearSuppressedNoteRouteTabOpens, suppressNoteRouteTabOpen } from "@/lib/note-route-tab-open-suppression";
import { printDocument } from "@/lib/print-document";
import { getPreviousTabAfterClose } from "@/lib/tab-closing";
import { getCycledTabTarget, getTabTargetAtIndex, type TabCycleDirection } from "@/lib/tab-cycling";
import {
    findTabByTarget,
    getCurrentRouteTabTarget,
    getRouteForTab,
    getTabTarget,
    isAiChatTab,
    isTerminalTab,
} from "@/lib/tab-target";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { useUIStore } from "@/store/ui.store";

const waitMap = new Map<string, string>();

function getEditorNoteId(): string | null {
    const editor = editorGlobalRef.current;
    if (!editor || editor.isDestroyed) return null;
    const storedNote = (editor.storage as { note?: { id?: string } }).note;
    return storedNote?.id ?? null;
}

export const RootLayout = () => {
    const [state, dispatch] = useGlobalStore();
    const [uiState, uiDispatch] = useUIStore();
    const [, layoutDispatch] = useLayoutStore();
    notificationRef.current = useNotification();
    usePwaUpdate();
    const navigate = useNavigate();
    const location = useLocation();
    const prevTabsRef = useRef(state.tabs);

    useEffect(() => {
        clearSuppressedNoteRouteTabOpens();
    }, [location.pathname, location.search]);

    const navigateToTab = useCallback(
        async (tab: (typeof state.tabs)[number]): Promise<void> => {
            const target = getTabTarget(tab);
            if (target.type === "note") {
                await dispatch.selectNoteById(target.id);
            } else if (target.type === "ai-chat") {
                await dispatch.addAiChatTab(target.id);
            } else {
                await dispatch.addTerminalTab(target.id);
            }
            navigate(getRouteForTab(tab));
        },
        [dispatch, navigate],
    );

    // Keyboard tab switching should mirror clicking a tab link: route first, then
    // the destination page synchronizes active tab state to avoid a two-step render.
    const navigateToTabRoute = useCallback(
        (tab: (typeof state.tabs)[number]): void => {
            navigate(getRouteForTab(tab));
        },
        [navigate],
    );

    const createNewAiChat = useCallback(async (): Promise<void> => {
        const chat = await createWorkspaceAiChat(state.directory);
        await dispatch.addAiChatTab(chat.id);
        navigate(`/chat?chatId=${encodeURIComponent(chat.id)}`);
    }, [dispatch, navigate, state.directory]);

    const getTerminalTitle = useCallback(
        (sessionId: string): string =>
            state.terminalSessions.find((session) => session.id === sessionId)?.title ?? "Terminal",
        [state.terminalSessions],
    );

    const confirmTerminalClose = useCallback(
        (sessionId: string, onConfirm: () => void): void => {
            const title = getTerminalTitle(sessionId);
            uiDispatch.setConfirm({
                open: true,
                type: "danger",
                title: `Close ${title}?`,
                message: `Closing terminal "${title}" will kill its running shell session.`,
                confirmText: "Close Terminal",
                onConfirm: () => {
                    uiDispatch.clearConfirm();
                    onConfirm();
                },
                onCancel: () => uiDispatch.clearConfirm(),
            });
        },
        [getTerminalTitle, uiDispatch],
    );

    useEffect(() => {
        if (!isElectron()) return;
        return window.electronAPI.onOpenFile(async ({ filePath, wait, requestId }) => {
            try {
                const existing = await window.electronAPI.db.notes.getByFilePath(filePath);
                let noteId: string;
                if (existing) {
                    noteId = existing.id;
                } else {
                    const content = await window.electronAPI.fs.readFile(filePath).catch(() => "");
                    const basename = filePath.split(/[\\/]/).pop() ?? filePath;
                    const title = basename.replace(/\.[^.]+$/, "");
                    const note = Note.new(title, typeof content === "string" ? content : "");
                    note.setFilePath(filePath, new Date());
                    await repositories.notes.save(note);
                    noteId = note.id;
                }
                if (wait) {
                    waitMap.set(noteId, requestId);
                }
                await dispatch.selectNoteById(noteId);
                navigate(`/note/${noteId}`);
            } catch (err) {
                console.error("Failed to open file from CLI:", err);
            }
        });
    }, []);

    useEffect(() => {
        if (!isElectron()) return;
        return window.electronAPI.onOpenFolder(({ folderPath }) => {
            if (state.directory === folderPath) return;
            void (async () => {
                try {
                    await migrateWebOnlyNotesToDirectory(folderPath);
                    await dispatch.switchWorkspace(folderPath);
                } catch (err) {
                    console.error("Failed to open folder from CLI:", err);
                }
            })();
        });
    }, [dispatch, state.directory]);

    useEffect(() => {
        if (!isElectron()) return;
        return window.electronAPI.onNavigate((pathname) => {
            navigate(pathname);
        });
    }, [navigate]);

    useEffect(() => {
        if (!isElectron()) return;
        void window.electronAPI.app.rendererReady(state.directory);
    }, [state.directory]);

    useEffect(() => {
        if (!isElectron()) return;
        const prevTabs = prevTabsRef.current;
        const removedTabs = prevTabs.filter((pt) => !state.tabs.find((ct) => ct.id === pt.id));
        for (const tab of removedTabs) {
            if (isAiChatTab(tab) || isTerminalTab(tab)) continue;
            const requestId = waitMap.get(tab.noteId);
            if (requestId) {
                window.electronAPI.app.notifyFileClosed(requestId);
                waitMap.delete(tab.noteId);
            }
        }
        prevTabsRef.current = state.tabs;
    }, [state.tabs]);

    useEffect(() => {
        if (location.pathname !== "/" || state.activeTabId === null) return;
        const activeTab = state.tabs.find(
            (tab) =>
                tab.id === state.activeTabId ||
                (!isAiChatTab(tab) && !isTerminalTab(tab) && tab.noteId === state.activeTabId),
        );
        if (activeTab) {
            navigate(getRouteForTab(activeTab), { replace: true });
        }
    }, [location.pathname, navigate, state.activeTabId, state.tabs]);

    useEffect(() => {
        if (!location.pathname.startsWith("/settings")) return;

        layoutDispatch.setActivity("settings");
        if (window.matchMedia("(min-width: 768px)").matches) {
            uiDispatch.setSidebarOpen(true);
        }
    }, [location.pathname]);

    const cycleEditorTab = useCallback(
        (direction: TabCycleDirection): void => {
            const currentTarget = getCurrentRouteTabTarget(location.pathname, location.search);
            const nextTarget = getCycledTabTarget({
                tabs: state.tabs,
                currentTarget,
                activeTabId: state.activeTabId,
                direction,
            });
            if (!nextTarget) return;
            const nextTab = findTabByTarget(state.tabs, nextTarget);
            if (!nextTab) return;
            navigateToTabRoute(nextTab);
        },
        [location.pathname, location.search, navigateToTabRoute, state.activeTabId, state.tabs],
    );

    const selectEditorTabByShortcut = useCallback(
        (shortcut: TabNavigationShortcut): void => {
            const nextTarget = getTabTargetAtIndex({
                tabs: state.tabs,
                index: shortcut.type === "last" ? "last" : shortcut.index,
            });
            if (!nextTarget) return;

            const nextTab = findTabByTarget(state.tabs, nextTarget);
            if (!nextTab) return;

            navigateToTabRoute(nextTab);
        },
        [navigateToTabRoute, state.tabs],
    );

    const closeCurrentTabOrHide = useCallback(async (): Promise<void> => {
        if (state.tabs.length === 0) {
            if (isElectron()) await window.electronAPI.app.hideToTray();
            return;
        }

        const currentTarget = getCurrentRouteTabTarget(location.pathname, location.search);
        const currentTab =
            findTabByTarget(state.tabs, currentTarget) ?? state.tabs.find((tab) => tab.id === state.activeTabId);
        if (!currentTab) return;

        const closeTab = async (): Promise<void> => {
            const nextTab = getPreviousTabAfterClose(state.tabs, currentTab.id);
            if (!isAiChatTab(currentTab) && !isTerminalTab(currentTab)) {
                suppressNoteRouteTabOpen(currentTab.noteId);
            }

            if (nextTab) {
                await navigateToTab(nextTab);
                await dispatch.removeTab(currentTab.id);
                return;
            }

            dispatch.activeTabId(null);
            navigate("/", { replace: true });
            await dispatch.removeTab(currentTab.id);
        };

        if (isTerminalTab(currentTab)) {
            confirmTerminalClose(currentTab.noteId, () => {
                void closeTab();
            });
            return;
        }

        await closeTab();
    }, [
        confirmTerminalClose,
        dispatch,
        location.pathname,
        location.search,
        navigate,
        navigateToTab,
        state.activeTabId,
        state.tabs,
    ]);

    useEffect(() => {
        if (!state.note || !location.pathname.startsWith("/note/")) return;
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== "Enter" && event.key !== " ") return;
        };
        document.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => {
            document.removeEventListener("keydown", handleKeyDown, { capture: true });
        };
    }, [location.pathname, state.note?.id]);

    useEffect(
        function registerBindings() {
            const tabNavigationHotkeys = Array.from({ length: 9 }, (_, index) => ({
                hotkey: getTabNavigationHotkey(index + 1, isElectron()),
                callback: () => {
                    selectEditorTabByShortcut(index === 8 ? { type: "last" } : { type: "index", index });
                },
                options: { stopPropagation: true },
            }));
            const unregisterHotkeys = registerHotkeys([
                ...tabNavigationHotkeys,
                {
                    hotkey: "Ctrl+Tab",
                    options: { stopPropagation: true },
                    callback: () => void cycleEditorTab("forward"),
                },
                {
                    hotkey: "Ctrl+Shift+Tab",
                    options: { stopPropagation: true },
                    callback: () => void cycleEditorTab("backward"),
                },
                {
                    hotkey: "Mod+W",
                    options: { stopPropagation: true },
                    callback: () => void closeCurrentTabOrHide(),
                },
                { hotkey: "Mod+Shift+P", callback: () => dispatch.commander(true) },
                {
                    hotkey: "Mod+Shift+N",
                    callback: () => void createNewAiChat(),
                    options: { stopPropagation: true },
                },
                {
                    hotkey: "Mod+N",
                    callback: () => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" }),
                },
                { hotkey: "Mod+,", callback: () => navigate("/settings") },
                {
                    hotkey: "Mod+P",
                    options: { preventDefault: false },
                    callback: (event) => {
                        if (!state.note || !location.pathname.startsWith("/note/")) return;
                        event.preventDefault();
                        printDocument({ title: state.note.title });
                    },
                },
                {
                    hotkey: "Mod+Shift+F",
                    callback: () => uiDispatch.toggleFocusMode(),
                },
                {
                    hotkey: "Mod+F",
                    options: { preventDefault: false },
                    callback: (event) => {
                        if (!editorGlobalRef.current) return;
                        event.preventDefault();
                        uiDispatch.toggleFindReplace();
                    },
                },
                {
                    hotkey: "Mod+B",
                    callback: () => uiDispatch.toggleSidebar(),
                },
            ]);

            const handleBeforeUnload = (): void => {
                const editor = editorGlobalRef.current;
                if (!state.note || !editor || editor.isDestroyed) return;
                if (!location.pathname.startsWith("/note/")) return;
                if (getEditorNoteId() !== state.note.id) return;
            };
            window.addEventListener("beforeunload", handleBeforeUnload);
            return () => {
                unregisterHotkeys();
                window.removeEventListener("beforeunload", handleBeforeUnload);
            };
        },
        [
            closeCurrentTabOrHide,
            createNewAiChat,
            cycleEditorTab,
            dispatch,
            location.pathname,
            navigate,
            selectEditorTabByShortcut,
            state.note,
            uiDispatch,
        ],
    );

    const isFloatingPanel = window.location.hash.includes("quicknote") || window.location.hash.includes("mathnote");

    useEffect(() => {
        if (!isFloatingPanel) return;
        document.documentElement.style.background = "transparent";
        document.body.style.background = "transparent";
    }, [isFloatingPanel]);

    if (isFloatingPanel) {
        return (
            <div className="relative flex h-screen flex-col overflow-hidden rounded-xl bg-background p-4 text-foreground ring-1 ring-border/40">
                <div className="quicknote-window-drag-strip" />
                <Suspense fallback={null}>
                    <div className="flex h-full min-h-0 flex-1 flex-col">
                        <Outlet />
                    </div>
                </Suspense>
            </div>
        );
    }

    return (
        <div className="isolate flex h-screen flex-1 flex-col items-center justify-center overflow-hidden print:block print:h-auto print:overflow-visible">
            <Fragment>
                <Commander
                    note={state.note}
                    tabs={state.tabs}
                    dispatch={dispatch}
                    notes={state.notes}
                    commander={state.commander}
                    noteGroups={state.noteGroups}
                    terminalSessions={state.terminalSessions}
                />
                <FindReplaceBar />
                <CreateNoteDialog />
                <CreateTemplateDialog />
                <CreateVariableDialog />
                <RecentNotesDialog />
                <ReadItLaterDialog />
                <AddToGroupDialog />
                <DirectoryBrowserDialog />
                <InspectJsonDialog />
                <TasksDialog />
                <GitSyncDialog />
                <MediaPreview />
                <AIDrawer />
                <KeyboardClickHints />
            </Fragment>
            <MainLayout />
            {uiState.focusMode && (
                <button
                    type="button"
                    title="Exit focus mode (⌘⇧F)"
                    onClick={() => uiDispatch.toggleFocusMode()}
                    className="animate-fade-in fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground/70 shadow-medium transition-[transform,color,background-color,border-color] hover:scale-105 hover:text-foreground"
                >
                    <CornersOutIcon className="size-4" />
                    <span>Exit Focus</span>
                </button>
            )}
            {uiState.alert && (
                <Alert
                    open={uiState.alert.open}
                    title={uiState.alert.title}
                    message={uiState.alert.message}
                    type={uiState.alert.type}
                    onClose={() => uiDispatch.clearAlert()}
                />
            )}
            {uiState.confirm && (
                <Confirm
                    open={uiState.confirm.open}
                    title={uiState.confirm.title}
                    message={uiState.confirm.message}
                    type={uiState.confirm.type}
                    confirmText={uiState.confirm.confirmText}
                    cancelText={uiState.confirm.cancelText}
                    onConfirm={uiState.confirm.onConfirm}
                    onCancel={() => {
                        uiState.confirm?.onCancel?.();
                        uiDispatch.clearConfirm();
                    }}
                />
            )}
            {uiState.prompt && (
                <Prompt
                    open={uiState.prompt.open}
                    title={uiState.prompt.title}
                    message={uiState.prompt.message}
                    initialValue={uiState.prompt.initialValue}
                    placeholder={uiState.prompt.placeholder}
                    onConfirm={(val) => {
                        uiState.prompt?.onConfirm(val);
                        uiDispatch.clearPrompt();
                    }}
                    onCancel={() => {
                        uiState.prompt?.onCancel?.();
                        uiDispatch.clearPrompt();
                    }}
                />
            )}
        </div>
    );
};
