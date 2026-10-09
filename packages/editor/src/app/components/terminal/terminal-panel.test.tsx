import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalPanel } from "./terminal-panel";

const mockPlatform = vi.hoisted(() => ({ isElectron: false }));

const mockTerminal = vi.hoisted(() => ({
    instance: { cols: 80, rows: 24 },
    write: vi.fn(),
    focus: vi.fn(),
}));

const mockBackend = vi.hoisted(() => ({
    start: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
    dataListener: null as ((data: string) => void) | null,
    exitListener: null as ((event: { exitCode?: number; signal?: number }) => void) | null,
    disposeData: vi.fn(),
    disposeExit: vi.fn(),
}));

const mockGhostty = vi.hoisted(() => ({
    load: vi.fn(),
    dispose: vi.fn(),
}));

vi.mock("@/lib/is-electron", () => ({
    isElectron: () => mockPlatform.isElectron,
}));

vi.mock("@/lib/terminal/factory", () => ({
    createTerminalBackend: vi.fn(() => mockBackend),
}));

vi.mock("@wterm/ghostty", () => ({
    GhosttyCore: { load: mockGhostty.load },
}));

vi.mock("@wterm/react", async () => {
    const React = await import("react");

    type MockTerminalHandle = {
        instance: { cols: number; rows: number };
        write: (data: string) => void;
        focus: () => void;
    };

    type MockTerminalProps = {
        "aria-label": string;
        core?: unknown;
        onData?: (data: string) => void;
        onResize?: (cols: number, rows: number) => void;
        onReady?: (terminal: unknown) => void;
        onError?: (error: unknown) => void;
    };

    const Terminal = React.forwardRef<MockTerminalHandle, MockTerminalProps>(function MockTerminal(props, ref) {
        React.useImperativeHandle(ref, () => ({
            instance: mockTerminal.instance,
            write: mockTerminal.write,
            focus: mockTerminal.focus,
        }));

        return React.createElement(
            "div",
            {
                role: "group",
                "aria-label": props["aria-label"],
                "data-has-core": String(Boolean(props.core)),
            },
            React.createElement(
                "button",
                { type: "button", onClick: () => props.onReady?.({}) },
                "Mark terminal ready",
            ),
            React.createElement(
                "button",
                { type: "button", onClick: () => props.onData?.("echo test\r") },
                "Send terminal input",
            ),
            React.createElement("button", { type: "button", onClick: () => props.onData?.("\r") }, "Send Enter"),
            React.createElement(
                "button",
                { type: "button", onClick: () => props.onResize?.(100, 40) },
                "Resize terminal",
            ),
            React.createElement(
                "button",
                { type: "button", onClick: () => props.onError?.(new Error("render failed")) },
                "Fail terminal",
            ),
        );
    });

    return { Terminal };
});

type TerminalPanelProps = {
    sessionId: string;
    active: boolean;
    cwd: string | null;
    showRestartNotice: boolean;
};

const defaultProps: TerminalPanelProps = {
    sessionId: "terminal-1",
    active: true,
    cwd: "/workspace",
    showRestartNotice: false,
};

function renderPanel(props: Partial<TerminalPanelProps> = {}) {
    return render(<TerminalPanel {...defaultProps} {...props} />);
}

describe("TerminalPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mockPlatform.isElectron = false;
        mockBackend.start.mockReset().mockResolvedValue(undefined);
        mockBackend.write.mockReset();
        mockBackend.resize.mockReset();
        mockBackend.kill.mockReset();
        mockBackend.onData.mockReset().mockImplementation((callback: (data: string) => void) => {
            mockBackend.dataListener = callback;
            return { dispose: mockBackend.disposeData };
        });
        mockBackend.onExit
            .mockReset()
            .mockImplementation((callback: (event: { exitCode?: number; signal?: number }) => void) => {
                mockBackend.exitListener = callback;
                return { dispose: mockBackend.disposeExit };
            });
        mockBackend.dataListener = null;
        mockBackend.exitListener = null;
        mockBackend.disposeData.mockReset();
        mockBackend.disposeExit.mockReset();
        mockGhostty.load.mockReset();
        mockGhostty.dispose.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("waits for WTerm readiness, then starts the backend and flushes early input", async () => {
        const view = renderPanel({ showRestartNotice: true });
        fireEvent.click(screen.getByRole("button", { name: "Send terminal input" }));

        expect(mockBackend.start).not.toHaveBeenCalled();

        view.rerender(<TerminalPanel {...defaultProps} cwd="/updated-workspace" showRestartNotice />);
        fireEvent.click(screen.getByRole("button", { name: "Mark terminal ready" }));

        await waitFor(() => {
            expect(mockBackend.start).toHaveBeenCalledWith("/updated-workspace");
            expect(mockBackend.write).toHaveBeenCalledWith("echo test\r");
            expect(mockBackend.resize).toHaveBeenCalledWith(80, 24);
        });
        expect(mockBackend.start).toHaveBeenCalledTimes(1);
        expect(mockTerminal.write).toHaveBeenCalledWith(
            expect.stringContaining("Terminal session restarted; previous process state could not be restored"),
        );
        expect(mockTerminal.focus).toHaveBeenCalled();
    });

    it("forwards live input, resize, output, and process restart events", async () => {
        renderPanel();
        fireEvent.click(screen.getByRole("button", { name: "Mark terminal ready" }));
        await waitFor(() => expect(mockBackend.resize).toHaveBeenCalledWith(80, 24));

        fireEvent.click(screen.getByRole("button", { name: "Send terminal input" }));
        fireEvent.click(screen.getByRole("button", { name: "Resize terminal" }));
        expect(mockBackend.write).toHaveBeenCalledWith("echo test\r");
        expect(mockBackend.resize).toHaveBeenCalledWith(100, 40);

        act(() => mockBackend.dataListener?.("shell output"));
        expect(mockTerminal.write).toHaveBeenCalledWith("shell output");

        act(() => mockBackend.exitListener?.({ exitCode: 0 }));
        fireEvent.click(screen.getByRole("button", { name: "Send Enter" }));
        await waitFor(() => expect(mockBackend.start).toHaveBeenCalledTimes(2));
        expect(mockTerminal.write).toHaveBeenCalledWith(expect.stringContaining("[Process restarted]"));
    });

    it("allows retry after backend startup fails", async () => {
        mockBackend.start.mockRejectedValueOnce(new Error("spawn failed"));
        renderPanel();
        fireEvent.click(screen.getByRole("button", { name: "Mark terminal ready" }));

        await waitFor(() => {
            expect(mockTerminal.write).toHaveBeenCalledWith(expect.stringContaining("Terminal failed to start"));
        });

        fireEvent.click(screen.getByRole("button", { name: "Send Enter" }));
        await waitFor(() => expect(mockBackend.start).toHaveBeenCalledTimes(2));
        expect(mockTerminal.write).toHaveBeenCalledWith(expect.stringContaining("[Process restarted]"));
    });

    it("shows an accessible error when WTerm cannot initialize", () => {
        renderPanel();
        fireEvent.click(screen.getByRole("button", { name: "Fail terminal" }));

        expect(screen.getByRole("alert")).toHaveTextContent("The terminal could not be initialized.");
        expect(mockBackend.start).not.toHaveBeenCalled();
    });

    it("disposes backend subscriptions and stops the session on unmount", async () => {
        const view = renderPanel();
        fireEvent.click(screen.getByRole("button", { name: "Mark terminal ready" }));
        await waitFor(() => expect(mockBackend.start).toHaveBeenCalledTimes(1));

        view.unmount();

        expect(mockBackend.disposeData).toHaveBeenCalledOnce();
        expect(mockBackend.disposeExit).toHaveBeenCalledOnce();
        expect(mockBackend.kill).toHaveBeenCalledOnce();
    });

    it("loads Ghostty on desktop and passes its core to WTerm", async () => {
        mockPlatform.isElectron = true;
        const core = { dispose: mockGhostty.dispose };
        mockGhostty.load.mockResolvedValue(core);
        const view = renderPanel();

        await screen.findByRole("button", { name: "Mark terminal ready" });
        expect(mockGhostty.load).toHaveBeenCalledOnce();
        expect(screen.getByRole("group", { name: "Terminal" })).toHaveAttribute("data-has-core", "true");

        fireEvent.click(screen.getByRole("button", { name: "Mark terminal ready" }));
        await waitFor(() => expect(mockBackend.start).toHaveBeenCalledWith("/workspace"));

        view.unmount();
        expect(mockGhostty.dispose).toHaveBeenCalledOnce();
    });

    it("shows an accessible error when Ghostty fails to load", async () => {
        mockPlatform.isElectron = true;
        mockGhostty.load.mockRejectedValue(new Error("WASM load failed"));
        renderPanel();

        expect(await screen.findByRole("alert")).toHaveTextContent("The terminal could not be initialized.");
        expect(mockBackend.start).not.toHaveBeenCalled();
    });
});
