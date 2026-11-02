import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { Mermaid } from "./mermaid";

describe("Mermaid", () => {
    it("renders a flowchart as an SVG with its labels", () => {
        const { container } = render(<Mermaid chart={"flowchart LR\n  A[Start] --> B[Finish]"} />);

        const svg = container.querySelector("svg.pele-flowchart");
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveTextContent("Start");
        expect(svg).toHaveTextContent("Finish");
    });

    it("renders a sequence diagram", () => {
        const { container } = render(<Mermaid chart={"sequenceDiagram\n  Alice->>Bob: Hello"} />);

        expect(container.querySelector("svg.pele-sequence")).toHaveTextContent("Hello");
    });

    it("renders inside React StrictMode", () => {
        const { container } = render(
            <StrictMode>
                <Mermaid chart={"flowchart LR\n  A --> B"} />
            </StrictMode>,
        );

        expect(container.querySelectorAll("svg")).toHaveLength(1);
    });

    it("replaces the SVG when the chart changes", () => {
        const { container, rerender } = render(<Mermaid chart={"flowchart LR\n  A[First] --> B"} />);
        rerender(<Mermaid chart={"flowchart LR\n  A[Second] --> B"} />);

        expect(container).not.toHaveTextContent("First");
        expect(container).toHaveTextContent("Second");
    });

    it("shows an alert with the parse error for an invalid diagram", () => {
        const { container } = render(<Mermaid chart={"flowchart LR\n  A -->"} />);

        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent("Mermaid diagram error:");
        expect(alert).toHaveTextContent("Parse error on line 2");
        expect(container.querySelector("svg")).not.toBeInTheDocument();
    });

    it("shows an alert when the diagram type is not supported", () => {
        render(<Mermaid chart="not a diagram" />);

        expect(screen.getByRole("alert")).toHaveTextContent("No diagram type detected");
    });

    it("replaces the error with the SVG once the chart is fixed", () => {
        const { container, rerender } = render(<Mermaid chart={"flowchart LR\n  A -->"} />);
        rerender(<Mermaid chart={"flowchart LR\n  A --> B"} />);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("renders nothing for an empty chart", () => {
        const { container } = render(<Mermaid chart="   " />);

        expect(container.querySelector(".mermaid")).toBeEmptyDOMElement();
    });

    it("does not output active HTML from diagram labels", () => {
        const { container } = render(
            <Mermaid chart={'flowchart LR\n  A["<img src=x onerror=alert(1)><script>alert(2)</script>"] --> B'} />,
        );

        expect(container.querySelector("img, script")).not.toBeInTheDocument();
        expect(container.innerHTML).not.toContain("onerror");
    });

    it("does not output javascript: links from click directives", () => {
        const { container } = render(
            <Mermaid chart={'flowchart LR\n  A --> B\n  click A "javascript:alert(1)"'} />,
        );

        expect(container.innerHTML).not.toContain("javascript:");
    });
});
