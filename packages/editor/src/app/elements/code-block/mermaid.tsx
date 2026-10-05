import mermaid from "mermaid";
import { useCallback, useEffect, useRef } from "react";
import { useThemeChange } from "@/app/hooks/use-theme-change";
import { createMermaidThemeVariables } from "./mermaid-theme";

let nextMermaidRenderId = 0;

mermaid.registerIconPacks([
    {
        name: "logos",
        loader: () => import("@iconify-json/logos").then((module) => module.icons),
    },
]);

const getMermaidConfig = (): Parameters<typeof mermaid.initialize>[0] => ({
    theme: "base",
    startOnLoad: false,
    markdownAutoWrap: true,
    securityLevel: "loose",
    arrowMarkerAbsolute: true,
    suppressErrorRendering: true,
    themeVariables: createMermaidThemeVariables(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const getMermaidErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (isRecord(error)) {
        const message = error.message ?? error.str ?? error.error;
        if (typeof message === "string") return message;
        if (message instanceof Error) return message.message;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return "Invalid Mermaid diagram";
    }
};

const renderMermaidError = (container: HTMLDivElement, message: string): void => {
    const errorElement = document.createElement("pre");
    errorElement.setAttribute("role", "alert");
    errorElement.className = "text-destructive text-xs whitespace-pre-wrap";
    errorElement.textContent = `Mermaid diagram error:\n${message}`;
    container.replaceChildren(errorElement);
};

export const Mermaid = (props: { chart: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const renderGenerationRef = useRef(0);

    const renderChart = useCallback(async () => {
        const container = containerRef.current;
        if (!container) return;

        const renderGeneration = renderGenerationRef.current + 1;
        renderGenerationRef.current = renderGeneration;

        if (!props.chart.trim()) {
            container.replaceChildren();
            return;
        }

        try {
            mermaid.initialize(getMermaidConfig());
            const renderId = `writeme-mermaid-${nextMermaidRenderId++}`;
            const { svg, bindFunctions } = await mermaid.render(renderId, props.chart, container);
            if (renderGeneration !== renderGenerationRef.current) {
                return;
            }

            container.innerHTML = svg;
            bindFunctions?.(container);
        } catch (error) {
            if (renderGeneration !== renderGenerationRef.current) {
                return;
            }

            const message = getMermaidErrorMessage(error);
            renderMermaidError(container, message);
        }
    }, [props.chart]);

    useEffect(() => {
        void renderChart();
        return () => {
            renderGenerationRef.current += 1;
        };
    }, [renderChart]);

    useThemeChange(() => {
        void renderChart();
    });

    return <div ref={containerRef} className="mermaid" />;
};
