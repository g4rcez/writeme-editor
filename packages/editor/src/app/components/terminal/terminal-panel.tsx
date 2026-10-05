import { FitAddon } from "@xterm/addon-fit";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { createTerminalBackend } from "@/lib/terminal/factory";

const RESTART_NOTICE =
    "\r\n\x1b[33m[Terminal session restarted; previous process state could not be restored]\x1b[0m\r\n";
const PROCESS_RESTARTED_NOTICE = "\r\n\x1b[33m[Process restarted]\x1b[0m\r\n";

type TerminalPanelProps = {
    sessionId: string;
    active: boolean;
    cwd: string | null;
    showRestartNotice: boolean;
};

export const TerminalPanel = ({ sessionId, active, cwd, showRestartNotice }: TerminalPanelProps) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const backendRef = useRef<ReturnType<typeof createTerminalBackend> | null>(null);
    const cwdRef = useRef<string | null>(cwd);
    const initializedRef = useRef(false);
    const exitedRef = useRef(false);
    const restartNoticeWrittenRef = useRef(false);
    const rafHandle = useRef<number | null>(null);
    const initTimeoutHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const subscriptionsRef = useRef<{ dispose: () => void }[]>([]);

    useEffect(() => {
        cwdRef.current = cwd;
    }, [cwd]);

    const fitAndFocus = (): void => {
        if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current);
        rafHandle.current = requestAnimationFrame(() => {
            rafHandle.current = null;
            try {
                fitAddonRef.current?.fit();
            } catch {
                // xterm can throw while the panel is hidden or has zero dimensions.
            }
            if (active) {
                xtermRef.current?.focus();
            }
        });
    };

    const startBackend = (notice?: string): void => {
        const term = xtermRef.current;
        const backend = backendRef.current;
        if (!term || !backend) return;

        exitedRef.current = false;
        if (notice) term.write(notice);
        backend.start(cwdRef.current);
        fitAndFocus();
    };

    useEffect(() => {
        if (!active || initializedRef.current || !terminalRef.current) return;

        initializedRef.current = true;
        const term = new Terminal({
            cursorBlink: true,
            fontFamily: '"JetBrainsMono Nerd Font", "JetBrains Mono", "Fira Code", monospace',
            customGlyphs: true,
            allowProposedApi: true,
            fontSize: 14,
            theme: {
                background: "#00000000",
                foreground: "#d4d4d4",
            },
        });

        const fitAddon = new FitAddon();
        const searchAddon = new SearchAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(searchAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(terminalRef.current);

        try {
            term.loadAddon(new WebglAddon());
        } catch (error) {
            console.warn("WebGL addon failed to load, falling back to canvas/dom", error);
        }

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const backend = createTerminalBackend(sessionId);
        backendRef.current = backend;

        subscriptionsRef.current = [
            term.onData((data) => {
                if (exitedRef.current) {
                    if (data === "\r") {
                        startBackend(PROCESS_RESTARTED_NOTICE);
                    }
                    return;
                }
                backend.write(data);
            }),
            term.onResize(({ cols, rows }) => {
                backend.resize(cols, rows);
            }),
            backend.onData((data) => {
                term.write(data);
            }),
            backend.onExit(() => {
                exitedRef.current = true;
            }),
        ];

        const notice = showRestartNotice && !restartNoticeWrittenRef.current ? RESTART_NOTICE : undefined;
        restartNoticeWrittenRef.current = true;
        startBackend(notice);

        try {
            fitAddon.fit();
        } catch {
            // Ignore initial fit error if dimensions are not ready.
        }

        initTimeoutHandle.current = setTimeout(() => {
            initTimeoutHandle.current = null;
            if (!term.element) return;
            fitAndFocus();
            try {
                term.loadAddon(new LigaturesAddon());
            } catch (error) {
                console.warn("Ligatures addon failed to load", error);
            }
        }, 50);

        resizeObserverRef.current = new ResizeObserver(() => fitAndFocus());
        resizeObserverRef.current.observe(terminalRef.current);
    }, [active, sessionId, showRestartNotice]);

    useEffect(() => {
        if (active && initializedRef.current) {
            fitAndFocus();
        }
    }, [active]);

    useEffect(
        () => () => {
            if (rafHandle.current !== null) {
                cancelAnimationFrame(rafHandle.current);
                rafHandle.current = null;
            }
            if (initTimeoutHandle.current !== null) {
                clearTimeout(initTimeoutHandle.current);
                initTimeoutHandle.current = null;
            }
            resizeObserverRef.current?.disconnect();
            for (const subscription of subscriptionsRef.current) {
                subscription.dispose();
            }
            subscriptionsRef.current = [];
            backendRef.current?.kill();
            backendRef.current = null;
            xtermRef.current?.dispose();
            xtermRef.current = null;
            initializedRef.current = false;
        },
        [],
    );

    return (
        <div className="w-full h-full p-2 bg-[#1e1e1e]">
            <div ref={terminalRef} className="w-full h-full" />
        </div>
    );
};
