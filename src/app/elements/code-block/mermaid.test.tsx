import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mermaidMock = vi.hoisted(() => ({
    initialize: vi.fn(),
    registerIconPacks: vi.fn(),
    render: vi.fn(),
}));

vi.mock("mermaid", () => ({
    default: mermaidMock,
}));

import { Mermaid } from "./mermaid";

type MermaidRenderResult = {
    svg: string;
    bindFunctions?: (element: Element) => void;
};

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });

    return { promise, resolve, reject };
};

describe("Mermaid", () => {
    beforeEach(() => {
        mermaidMock.initialize.mockClear();
        mermaidMock.registerIconPacks.mockClear();
        mermaidMock.render.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders a Mermaid SVG into the container", async () => {
        mermaidMock.render.mockResolvedValue({
            svg: '<svg data-testid="mermaid-svg"></svg>',
            bindFunctions: vi.fn(),
        });

        render(<Mermaid chart="graph TD; A-->B" />);

        expect(await screen.findByTestId("mermaid-svg")).toBeInTheDocument();
        expect(mermaidMock.render).toHaveBeenCalledWith(
            expect.stringMatching(/^writeme-mermaid-/),
            "graph TD; A-->B",
            expect.any(HTMLDivElement),
        );
    });

    it("handles Mermaid object-shaped render errors", async () => {
        mermaidMock.render.mockRejectedValue({ str: "Parse error on line 1" });

        render(<Mermaid chart="not a diagram" />);

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes("Parse error on line 1"))).toBeInTheDocument();
        });
        expect(screen.getByRole("alert")).toHaveTextContent("Mermaid diagram error:");
    });

    it("renders inside React StrictMode", async () => {
        mermaidMock.render.mockResolvedValue({
            svg: '<svg data-testid="strict-mode-mermaid-svg"></svg>',
        });

        render(
            <StrictMode>
                <Mermaid chart="graph TD; A-->B" />
            </StrictMode>,
        );

        expect(await screen.findByTestId("strict-mode-mermaid-svg")).toBeInTheDocument();
    });

    it("does not let a slow stale render overwrite a newer chart", async () => {
        const firstRender = createDeferred<MermaidRenderResult>();
        const secondRender = createDeferred<MermaidRenderResult>();
        mermaidMock.render.mockReturnValueOnce(firstRender.promise).mockReturnValueOnce(secondRender.promise);

        const { rerender } = render(<Mermaid chart="graph TD; A-->B" />);

        await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));
        rerender(<Mermaid chart="graph TD; C-->D" />);
        await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));

        secondRender.resolve({
            svg: '<svg data-testid="latest-mermaid-svg"></svg>',
        });
        await screen.findByTestId("latest-mermaid-svg");

        firstRender.resolve({
            svg: '<svg data-testid="stale-mermaid-svg"></svg>',
        });
        await firstRender.promise;

        expect(screen.queryByTestId("stale-mermaid-svg")).not.toBeInTheDocument();
        expect(screen.getByTestId("latest-mermaid-svg")).toBeInTheDocument();
    });

    it("ignores render failures after unmount", async () => {
        const renderAttempt = createDeferred<MermaidRenderResult>();
        mermaidMock.render.mockReturnValue(renderAttempt.promise);
        const { container, unmount } = render(<Mermaid chart="graph TD; A-->B" />);

        await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));
        unmount();
        renderAttempt.reject({ str: "late parse error" });

        await renderAttempt.promise.catch(() => undefined);

        expect(container).toBeEmptyDOMElement();
    });
});
