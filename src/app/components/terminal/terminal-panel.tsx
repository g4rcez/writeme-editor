import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { WebglAddon } from "@xterm/addon-webgl";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import "@xterm/xterm/css/xterm.css";
import { createTerminalBackend } from "@/lib/terminal/factory";
import { useGlobalStore } from "@/store/global.store";

export const TerminalPanel = () => {
  const [state] = useGlobalStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const backendRef = useRef<ReturnType<typeof createTerminalBackend> | null>(
    null,
  );

  useEffect(() => {
    if (!terminalRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        '"JetBrainsMono Nerd Font", "JetBrains Mono", "Fira Code", monospace',
      customGlyphs: true,
      allowProposedApi: true,
      fontSize: 14,
      theme: {
        background: "#00000000", // Transparent to use parent background
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
    } catch (e) {
      console.warn("WebGL addon failed to load, falling back to canvas/dom", e);
    }

    xtermRef.current = term;

    // Initialize Backend
    const backend = createTerminalBackend();
    backendRef.current = backend;

    // Connect Terminal to Backend
    term.onData((data) => {
      backend.write(data);
    });

    const dataSubscription = backend.onData((data) => {
      term.write(data);
    });

    term.onResize(({ cols, rows }) => {
      backend.resize(cols, rows);
    });

    // Start Backend and fit
    backend.start(state.directory);

    // Fit immediately, then slightly delayed to ensure DOM is ready
    try {
      fitAddon.fit();
    } catch (e) {
      // Ignore initial fit error if dimensions aren't ready
    }

    setTimeout(() => {
      if (term.element) {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore
        }
        try {
          term.loadAddon(new LigaturesAddon());
        } catch (e) {
          console.warn("Ligatures addon failed to load", e);
        }
        term.focus();
      }
    }, 50);

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore
        }
      });
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      dataSubscription.dispose();
      backend.kill();
      term.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full p-2 bg-[#1e1e1e]">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
};
