import type { BundledLanguage } from "shiki";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Fragment, lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { updateNodeContent } from "@/lib/editor-utils";
import { EXECUTION_CONFIG } from "@/lib/execution-config";
import { isElectron } from "@/lib/is-electron";
import { CodeBlockFrame } from "../code-block";
import { canFormat, formatCode } from "../code-block-formatting";
import { CodeBlockHeader } from "./code-block-header";
import { ExecutionOutput } from "./execution-output";

const ExcalidrawCode = lazy(() =>
    import("./excalidraw").then((m) => ({
        default: m.ExcalidrawCode,
    })),
);

const Flowchart = lazy(() => import("./flowchart").then((m) => ({ default: m.Flowchart })));

const Graphviz = lazy(() => import("./graphviz").then((m) => ({ default: m.Graphviz })));

const MathBlock = lazy(() => import("./math-block").then((m) => ({ default: m.MathBlock })));

const Mermaid = lazy(() => import("./mermaid").then((m) => ({ default: m.Mermaid })));

const LatexBlock = lazy(() => import("./latex-block").then((m) => ({ default: m.LatexBlock })));

const FreehandCode = lazy(() => import("./freehand").then((m) => ({ default: m.FreehandCode })));

const CodeBlockAddons = ({ language, code }: { language: string; code: string }) => {
    if (language === "math" && code) {
        return (
            <Suspense fallback={null}>
                <MathBlock code={code} />
            </Suspense>
        );
    }
    if (language === "latex" && code) {
        return (
            <Suspense fallback={null}>
                <LatexBlock code={code} />
            </Suspense>
        );
    }
    if (language === "mermaid" && code) {
        return (
            <div className="px-4 pb-4">
                <div className="pt-4 border-t border-card-border">
                    <Suspense fallback={null}>
                        <Mermaid chart={code} />
                    </Suspense>
                </div>
            </div>
        );
    }
    if (language === "graphviz" && code) {
        return (
            <div className="px-4 pb-4">
                <div className="pt-4 border-t border-card-border">
                    <Suspense fallback={null}>
                        <Graphviz dot={code} />
                    </Suspense>
                </div>
            </div>
        );
    }
    if (language === "flowchart" && code) {
        return (
            <div className="px-4 pb-4">
                <div className="pt-4 border-t border-card-border">
                    <Suspense fallback={null}>
                        <Flowchart code={code} />
                    </Suspense>
                </div>
            </div>
        );
    }
    return null;
};

type OutputState = {
    stdout: string;
    stderr: string;
    html?: string;
};

export const CodeBlockRenderer = (props: ReactNodeViewProps) => {
    const id = useId();
    const language = props.node.attrs.language || "plaintext";
    const title = props.node.attrs.title as string | null;
    const codeFromNode = props.node.textContent;
    const codeRef = useRef(codeFromNode);
    const [code, setCode] = useState(codeFromNode);
    const [isFormatting, setIsFormatting] = useState(false);
    const [executablePath, setExecutablePath] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [output, setOutput] = useState<OutputState | null>(null);
    const copyFeedbackTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (codeRef.current === codeFromNode) return;
        codeRef.current = codeFromNode;
        setCode(codeFromNode);
    }, [codeFromNode]);

    useEffect(() => {
        return () => {
            if (copyFeedbackTimeoutRef.current !== null) {
                window.clearTimeout(copyFeedbackTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isElectron()) return;
        const checkExecutable = async () => {
            const config = EXECUTION_CONFIG[language as BundledLanguage];
            if (config && config.command !== "browser") {
                const path = await window.electronAPI.execution.resolve(config.command);
                setExecutablePath(path);
            } else {
                setExecutablePath(null);
            }
        };
        checkExecutable();
    }, [language]);

    useEffect(() => {
        const pos = props.getPos();
        if (typeof pos !== "number") return;
        const dom = props.editor.view.nodeDOM(pos);
        if (!(dom instanceof Element)) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return;
                const currentPos = props.getPos();
                if (typeof currentPos !== "number") return;
                props.editor.view.dispatch(props.editor.state.tr.setMeta("shikiHighlightPos", currentPos));
            },
            { rootMargin: "200px" },
        );
        observer.observe(dom);
        return () => observer.disconnect();
    }, []);

    const handleLanguageChange = (newLanguage: string) => {
        const { view, getPos } = props;
        const pos = getPos();
        if (typeof pos !== "number") return;
        view.dispatch(
            view.state.tr.setNodeMarkup(pos, undefined, {
                ...props.node.attrs,
                language: newLanguage,
            }),
        );
        setOutput(null);
    };

    const handleFormat = async () => {
        if (!canFormat(language)) return;
        setIsFormatting(true);
        try {
            const formatted = await formatCode(code, language);
            if (formatted === code) return;
            const pos = props.getPos();
            if (typeof pos !== "number") return;
            const targetNode = props.editor.state.doc.nodeAt(pos);
            updateNodeContent(props.editor, targetNode, formatted);
            codeRef.current = formatted;
            setCode(formatted);
        } finally {
            setIsFormatting(false);
        }
    };

    const config = EXECUTION_CONFIG[language as BundledLanguage];
    const canRun = !!(config?.browserRuntimeExec || (isElectron() && executablePath));

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        if (copyFeedbackTimeoutRef.current !== null) {
            window.clearTimeout(copyFeedbackTimeoutRef.current);
        }
        copyFeedbackTimeoutRef.current = window.setTimeout(() => {
            setIsCopied(false);
            copyFeedbackTimeoutRef.current = null;
        }, 2000);
    };

    const handleRun = async () => {
        if (!config) return;
        setIsRunning(true);
        setOutput(null);
        try {
            if (config.browserRuntimeExec && (!isElectron() || config.command === "browser")) {
                const result = await config.browserRuntimeExec(code);
                setOutput(result);
            } else if (isElectron() && executablePath) {
                const result = await window.electronAPI.execution.run(config.command, config.args, code);
                setOutput({ stdout: result.stdout, stderr: result.stderr });
            }
        } catch (e) {
            setOutput({ stdout: "", stderr: `Error: ${e}` });
        } finally {
            setIsRunning(false);
        }
    };

    const onChangeDraw = useCallback((nextState: any) => {
        const pos = props.getPos();
        if (typeof pos !== "number") return;
        const targetNode = props.editor.state.doc.nodeAt(pos);
        updateNodeContent(props.editor, targetNode, nextState);
    }, []);

    if (language === "excalidraw") {
        return (
            <NodeViewWrapper
                as="div"
                className="overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-card-border"
            >
                <Suspense fallback={null}>
                    <ExcalidrawCode code={code} onChange={onChangeDraw} autoDelete={props.deleteNode} />
                </Suspense>
            </NodeViewWrapper>
        );
    }

    if (language === "freehand") {
        return (
            <NodeViewWrapper
                as="div"
                className="overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-card-border"
            >
                <Suspense fallback={null}>
                    <FreehandCode code={code} onChange={onChangeDraw} autoDelete={props.deleteNode} />
                </Suspense>
            </NodeViewWrapper>
        );
    }

    const lines = code.split("\n").length;

    return (
        <CodeBlockFrame
            lineCount={lines}
            printContent={code}
            id={`code-block-${language}-${id}`}
            header={
                <CodeBlockHeader
                    code={code}
                    lines={lines}
                    title={title}
                    canRun={canRun}
                    language={language}
                    handleRun={handleRun}
                    isRunning={isRunning}
                    onCopy={handleCopy}
                    isCopied={isCopied}
                    onFormat={handleFormat}
                    isFormatting={isFormatting}
                    onChangeLanguage={handleLanguageChange}
                />
            }
            footer={
                <Fragment>
                    <CodeBlockAddons language={language} code={code} />
                    {output && (
                        <ExecutionOutput
                            html={output.html}
                            output={output.stdout}
                            stderr={output.stderr}
                            onClose={() => setOutput(null)}
                        />
                    )}
                </Fragment>
            }
        >
            <NodeViewContent className="font-mono outline-none content is-editable code-content-renderer" />
        </CodeBlockFrame>
    );
};
