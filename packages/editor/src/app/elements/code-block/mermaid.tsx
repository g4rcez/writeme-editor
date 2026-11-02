import { PeleError, render } from "pele";
import { type ReactElement, useMemo } from "react";

type MermaidResult = { svg: string } | { error: string };

const renderChart = (chart: string): MermaidResult => {
    try {
        return { svg: render(chart).svg };
    } catch (error) {
        if (error instanceof PeleError) return { error: error.message };
        throw error;
    }
};

// Pele reads its colors from --pele-* CSS variables (see styles/mermaid.css), so a theme change needs no re-render.
export const Mermaid = (props: { chart: string }): ReactElement => {
    const result = useMemo(() => (props.chart.trim() ? renderChart(props.chart) : null), [props.chart]);

    return (
        <div className="mermaid">
            {result && "error" in result ? (
                <pre role="alert" className="text-destructive text-xs whitespace-pre-wrap">
                    {`Mermaid diagram error:\n${result.error}`}
                </pre>
            ) : null}
            {result && "svg" in result ? <div dangerouslySetInnerHTML={{ __html: result.svg }} /> : null}
        </div>
    );
};
