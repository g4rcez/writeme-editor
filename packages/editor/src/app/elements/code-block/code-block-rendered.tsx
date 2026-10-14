import type { BundledLanguage } from "shiki";
import { closeHistory } from "@tiptap/pm/history";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Fragment, lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { FEATURES } from "@/lib/build-features";
import { updateNodeContent } from "@/lib/editor-utils";
import { EXECUTION_CONFIG } from "@/lib/execution-config";
import { isElectron } from "@/lib/is-electron";
import { CodeBlockFrame } from "../code-block";
import { canFormat, formatCode } from "../code-block-formatting";
import { CodeBlockHeader } from "./code-block-header";
import {
    fingerprintCode,
    MAX_CODE_RESULT_CHARS,
    parseCodeExecutionResult,
    type CodeExecutionResult,
} from "./code-result";
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
    executedAt: string;
    language: string;
    source: string;
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
    const [resultError, setResultError] = useState<string | null>(null);
    const [codeFingerprint, setCodeFingerprint] = useState<{ source: string; value: string } | null>(null);
    const storedResult = parseCodeExecutionResult(
        typeof props.node.attrs.executionResult === "string" ? props.node.attrs.executionResult : null,
    );
    const copyFeedbackTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (codeRef.current === codeFromNode) return;
        codeRef.current = codeFromNode;
        setCode(codeFromNode);
    }, [codeFromNode]);

    useEffect(() => {
        let active = true;
        if (!storedResult) return;
        void fingerprintCode(codeFromNode)
            .then((fingerprint) => {
                if (active) setCodeFingerprint({ source: codeFromNode, value: fingerprint });
            })
            .catch(() => {
                if (active) setCodeFingerprint(null);
            });
        return () => {
            active = false;
        };
    }, [codeFromNode, props.node.attrs.executionResult]);

    useEffect(() => {
        return () => {
            if (copyFeedbackTimeoutRef.current !== null) window.clearTimeout(copyFeedbackTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!FEATURES.codeExecution || !isElectron()) return;
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
    const canRun = FEATURES.codeExecution && !!(config?.browserRuntimeExec || (isElectron() && executablePath));

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
        if (!FEATURES.codeExecution || !config) return;
        const executedAt = new Date().toISOString();
        const executionLanguage = language;
        const source = code;
        setIsRunning(true);
        setOutput(null);
        setResultError(null);
        try {
            if (config.browserRuntimeExec && (!isElectron() || config.command === "browser")) {
                const result = await config.browserRuntimeExec(source);
                setOutput({ ...result, executedAt, language: executionLanguage, source });
            } else if (isElectron() && executablePath) {
                const result = await window.electronAPI.execution.run(config.command, config.args, source);
                setOutput({
                    stdout: result.stdout,
                    stderr: result.stderr,
                    executedAt,
                    language: executionLanguage,
                    source,
                });
            }
        } catch (e) {
            setOutput({
                stdout: "",
                stderr: `Error: ${e}`,
                executedAt,
                language: executionLanguage,
                source,
            });
        } finally {
            setIsRunning(false);
        }
    };

    const handleKeepResult = async () => {
        if (!output || output.html) return;
        if (output.stdout.length + output.stderr.length > MAX_CODE_RESULT_CHARS) {
            setResultError(
                `Result is too large to keep. The combined output limit is ${MAX_CODE_RESULT_CHARS.toLocaleString()} characters.`,
            );
            return;
        }
        try {
            const result: CodeExecutionResult = {
                version: 1,
                executedAt: output.executedAt,
                language: output.language,
                sourceFingerprint: await fingerprintCode(output.source),
                stdout: output.stdout,
                stderr: output.stderr,
            };
            const pos = props.getPos();
            if (typeof pos !== "number") throw new Error("The code block is no longer available.");
            const targetNode = props.editor.state.doc.nodeAt(pos);
            if (!targetNode || targetNode.type.name !== "codeBlock") {
                throw new Error("The code block is no longer available.");
            }
            props.editor.view.dispatch(
                closeHistory(
                    props.editor.state.tr.setNodeMarkup(pos, undefined, {
                        ...targetNode.attrs,
                        executionResult: JSON.stringify(result),
                    }),
                ),
            );
            setResultError(null);
            setOutput(null);
        } catch (error) {
            setResultError(error instanceof Error ? error.message : "Unable to keep this execution result.");
        }
    };

    const handleRemoveResult = () => {
        const pos = props.getPos();
        if (typeof pos !== "number") {
            setResultError("The code block is no longer available.");
            return;
        }
        const targetNode = props.editor.state.doc.nodeAt(pos);
        if (!targetNode || targetNode.type.name !== "codeBlock") {
            setResultError("The code block is no longer available.");
            return;
        }
        try {
            props.editor.view.dispatch(
                closeHistory(
                    props.editor.state.tr.setNodeMarkup(pos, undefined, {
                        ...targetNode.attrs,
                        executionResult: null,
                    }),
                ),
            );
            setResultError(null);
        } catch (error) {
            setResultError(error instanceof Error ? error.message : "Unable to remove this execution result.");
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
                contentEditable={false}
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
    const storedResultIsOutdated =
        !!storedResult &&
        (storedResult.language !== language ||
            (codeFingerprint?.source === codeFromNode && codeFingerprint.value !== storedResult.sourceFingerprint));

    return (
        <CodeBlockFrame
            lineCount={lines}
            contentClassName={title ? "px-6 py-2" : undefined}
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
                    {(output || storedResult || resultError) && (
                        <ExecutionOutput
                            html={output?.html}
                            output={output?.stdout ?? storedResult?.stdout ?? ""}
                            stderr={output?.stderr ?? storedResult?.stderr ?? ""}
                            onClose={output ? () => setOutput(null) : undefined}
                            onKeep={props.editor.isEditable && output && !output.html ? handleKeepResult : undefined}
                            onRemove={props.editor.isEditable && storedResult ? handleRemoveResult : undefined}
                            saved={!output && !!storedResult}
                            executedAt={output?.executedAt ?? storedResult?.executedAt}
                            keepLabel={storedResult ? "Replace result" : "Keep result"}
                            outdated={
                                output
                                    ? output.language !== language || output.source !== codeFromNode
                                    : storedResultIsOutdated
                            }
                            error={resultError}
                        />
                    )}
                </Fragment>
            }
        >
            <NodeViewContent className="font-mono outline-none content is-editable code-content-renderer" />
        </CodeBlockFrame>
    );
};
