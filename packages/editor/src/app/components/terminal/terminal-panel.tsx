import type { GhosttyCore } from "@wterm/ghostty";
import type { ReactNode } from "react";
import { Terminal as WTermTerminal, type TerminalHandle, type WTerm } from "@wterm/react";
import "@wterm/dom/src/terminal.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ITerminalBackend } from "@/lib/terminal/types";
import { isElectron } from "@/lib/is-electron";
import { createTerminalBackend } from "@/lib/terminal/factory";
import "./terminal-panel.css";

const RESTART_NOTICE =
    "\r\n\x1b[33m[Terminal session restarted; previous process state could not be restored]\x1b[0m\r\n";
const PROCESS_RESTARTED_NOTICE = "\r\n\x1b[33m[Process restarted]\x1b[0m\r\n";
const MAX_BUFFERED_INPUT = 64 * 1024;

type TerminalPanelProps = {
    sessionId: string;
    active: boolean;
    cwd: string | null;
    showRestartNotice: boolean;
};

export const TerminalPanel = ({ sessionId, active, cwd, showRestartNotice }: TerminalPanelProps) => {
    const desktop = isElectron();
    const [hasBeenActive, setHasBeenActive] = useState(false);
    const terminalMounted = active || hasBeenActive;
    const [ghosttyCore, setGhosttyCore] = useState<GhosttyCore | null>(null);
    const [ghosttyFailed, setGhosttyFailed] = useState(false);
    const [terminalReady, setTerminalReady] = useState(false);
    const [terminalFailed, setTerminalFailed] = useState(false);
    const terminalRef = useRef<TerminalHandle>(null);
    const backendRef = useRef<ITerminalBackend | null>(null);
    const cwdRef = useRef<string | null>(cwd);
    const activeRef = useRef(active);
    const terminalReadyRef = useRef(false);
    const pendingInputRef = useRef<string[]>([]);
    const pendingInputSizeRef = useRef(0);
    const inputOverflowReportedRef = useRef(false);
    const exitedRef = useRef(false);
    const restartNoticeWrittenRef = useRef(false);
    const subscriptionsRef = useRef<{ dispose: () => void }[]>([]);

    useEffect(() => {
        cwdRef.current = cwd;
    }, [cwd]);

    useLayoutEffect(() => {
        activeRef.current = active;
    }, [active]);

    useEffect(() => {
        if (!desktop || !terminalMounted) return;

        let cancelled = false;
        let loadedCore: GhosttyCore | null = null;

        void import("@wterm/ghostty")
            .then(({ GhosttyCore: Core }) => Core.load())
            .then((core) => {
                if (cancelled) {
                    core.dispose();
                    return;
                }
                loadedCore = core;
                setGhosttyCore(core);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    console.error("Failed to load the Ghostty terminal core", error);
                    setGhosttyFailed(true);
                }
            });

        return () => {
            cancelled = true;
            loadedCore?.dispose();
        };
    }, [desktop, terminalMounted]);

    const startBackend = useCallback(async (notice?: string): Promise<void> => {
        const terminal = terminalRef.current;
        const backend = backendRef.current;
        if (!terminal || !backend) return;

        exitedRef.current = false;
        if (notice) terminal.write(notice);

        await backend.start(cwdRef.current);
        const pendingInput = pendingInputRef.current.splice(0);
        pendingInputSizeRef.current = 0;
        inputOverflowReportedRef.current = false;
        for (const input of pendingInput) backend.write(input);

        const instance = terminalRef.current?.instance;
        if (instance) backend.resize(instance.cols, instance.rows);
        if (activeRef.current) terminalRef.current?.focus();
    }, []);

    const handleBackendStartError = useCallback((error: unknown): void => {
        exitedRef.current = true;
        terminalRef.current?.write("\r\n\x1b[31mTerminal failed to start. Press Enter to retry.\x1b[0m\r\n");
        console.error("Failed to start the terminal backend", error);
    }, []);

    const startBackendIfReady = useCallback(() => {
        if (!active || !terminalReadyRef.current || backendRef.current || !terminalRef.current?.instance) return;

        const backend = createTerminalBackend(sessionId);
        backendRef.current = backend;
        subscriptionsRef.current = [
            backend.onData((data) => terminalRef.current?.write(data)),
            backend.onExit(() => {
                exitedRef.current = true;
            }),
        ];

        const notice = showRestartNotice && !restartNoticeWrittenRef.current ? RESTART_NOTICE : undefined;
        restartNoticeWrittenRef.current = true;
        void startBackend(notice).catch(handleBackendStartError);
    }, [active, handleBackendStartError, sessionId, showRestartNotice, startBackend]);

    useEffect(() => {
        startBackendIfReady();
    }, [startBackendIfReady]);

    useEffect(() => {
        if (active && terminalReady) terminalRef.current?.focus();
    }, [active, terminalReady]);

    useEffect(
        () => () => {
            for (const subscription of subscriptionsRef.current) subscription.dispose();
            subscriptionsRef.current = [];
            pendingInputRef.current = [];
            pendingInputSizeRef.current = 0;
            backendRef.current?.kill();
            backendRef.current = null;
        },
        [],
    );

    const handleReady = useCallback(
        (_terminal: WTerm) => {
            terminalReadyRef.current = true;
            setHasBeenActive(true);
            setTerminalReady(true);
            startBackendIfReady();
        },
        [startBackendIfReady],
    );

    const handleData = useCallback(
        (data: string) => {
            if (exitedRef.current) {
                if (data === "\r") void startBackend(PROCESS_RESTARTED_NOTICE).catch(handleBackendStartError);
                return;
            }

            const backend = backendRef.current;
            if (backend) {
                backend.write(data);
                return;
            }

            if (pendingInputSizeRef.current + data.length > MAX_BUFFERED_INPUT) {
                if (!inputOverflowReportedRef.current) {
                    terminalRef.current?.write(
                        "\r\n\x1b[31mInput was not accepted while the terminal was starting.\x1b[0m\r\n",
                    );
                    inputOverflowReportedRef.current = true;
                }
                return;
            }
            pendingInputRef.current.push(data);
            pendingInputSizeRef.current += data.length;
        },
        [handleBackendStartError, startBackend],
    );

    const handleResize = useCallback((cols: number, rows: number) => {
        backendRef.current?.resize(cols, rows);
    }, []);

    const handleTerminalError = useCallback((error: unknown) => {
        console.error("WTerm failed to initialize", error);
        setTerminalFailed(true);
    }, []);

    let content: ReactNode = null;
    if (terminalMounted) {
        if (ghosttyFailed || terminalFailed) {
            content = (
                <div className="p-2 text-foreground" role="alert">
                    The terminal could not be initialized.
                </div>
            );
        } else if (desktop && !ghosttyCore) {
            content = <output className="p-2 text-foreground">Loading terminal…</output>;
        } else {
            content = (
                <WTermTerminal
                    ref={terminalRef}
                    aria-label="Terminal"
                    className="writeme-terminal h-full w-full"
                    core={desktop ? (ghosttyCore ?? undefined) : undefined}
                    autoResize
                    cursorBlink
                    renderingPaused={!active}
                    onData={handleData}
                    onResize={handleResize}
                    onReady={handleReady}
                    onError={handleTerminalError}
                />
            );
        }
    }

    return <div className="h-full min-h-0 w-full bg-[#1e1e1e] p-2">{content}</div>;
};
