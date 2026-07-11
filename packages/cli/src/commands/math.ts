import { mkdir, readFile, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";
import { evaluateCode, evaluateInlineMath, type EvaluatedLine, type ExchangeRateData } from "solver";

const CURRENCY_HINT_RE = /[$€£¥₩₹₽₺฿₱₫]\s*\d|\b\d[\d.,]*\s+[A-Za-z]{3}\s+(?:to|in)\s+[A-Za-z]{3}\b/i;

const EXIT_COMMANDS = new Set([".exit", ".quit", "exit", "quit"]);

export function getMathHistoryPath(): string {
    return path.join(homedir(), ".config", "writeme", "math-repl");
}

export async function appendMathHistory(expression: string, historyPath = getMathHistoryPath()): Promise<void> {
    await mkdir(path.dirname(historyPath), { recursive: true });
    await appendFile(historyPath, `${expression}\n`, "utf8");
}

async function readMathHistory(historyPath: string): Promise<string[]> {
    try {
        const content = await readFile(historyPath, "utf8");
        return content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    } catch {
        return [];
    }
}

function renderResult(result: Extract<EvaluatedLine, { result: unknown }>["result"]): string {
    return result.ok ? result.value : `Error: ${result.message}`;
}

function renderLine(line: EvaluatedLine): string | null {
    switch (line.kind) {
        case "empty":
            return null;
        case "header":
            return `# ${line.text}`;
        case "comment":
            return line.text;
        case "variable":
            return `${line.name} = ${renderResult(line.result)}`;
        case "label":
            return `${line.label}: ${renderResult(line.result)}`;
        case "bare":
            return `${line.raw} = ${renderResult(line.result)}`;
        case "sum":
        case "avg":
            return `${line.kind}: ${renderResult(line.result)}`;
    }
}

async function fetchExchangeRates(base: string): Promise<ExchangeRateData | null> {
    try {
        const response = await fetch(`https://api.frankfurter.dev/v1/latest?from=${base}`);
        if (!response.ok) return null;
        const data = (await response.json()) as {
            base: string;
            date: string;
            rates: Record<string, number>;
        };
        return {
            base: data.base,
            date: data.date,
            rates: data.rates,
            timestamp: Math.floor(new Date(data.date).getTime() / 1000),
        };
    } catch {
        return null;
    }
}

async function loadRatesIfNeeded(code: string): Promise<ExchangeRateData | null> {
    if (!CURRENCY_HINT_RE.test(code)) return null;
    return fetchExchangeRates("EUR");
}

type ExprCommandArgs = {
    code: string;
};

export async function handleExpr(args: ExprCommandArgs): Promise<void> {
    const code = args.code.trim().replace(/\\n/g, "\n");
    if (!code) {
        console.log("Usage: writeme expr <expression>");
        process.exitCode = 1;
        return;
    }

    const ratesData = await loadRatesIfNeeded(code);
    const result = evaluateInlineMath(code, ratesData);
    if (result.ok) {
        console.log(result.value);
    } else {
        console.error(result.message);
        process.exitCode = 1;
    }
}

type MathReplArgs = {
    historyPath?: string;
};

export async function handleMathRepl(args: MathReplArgs = {}): Promise<void> {
    const historyPath = args.historyPath ?? getMathHistoryPath();
    const history = await readMathHistory(historyPath);
    const sessionLines: string[] = [];

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "math> ",
        history: history.toReversed(),
    });

    console.log("Writeme math REPL. Type .exit to quit.");
    rl.prompt();

    for await (const line of rl) {
        const expression = line.trim();
        if (EXIT_COMMANDS.has(expression)) {
            rl.close();
            break;
        }

        if (expression.length === 0) {
            rl.prompt();
            continue;
        }

        await appendMathHistory(expression, historyPath);
        sessionLines.push(expression);

        const ratesData = await loadRatesIfNeeded(sessionLines.join("\n"));
        const evaluated = evaluateCode(sessionLines.join("\n"), ratesData);
        const output = evaluated.at(-1);
        if (output) {
            const rendered = renderLine(output);
            if (rendered) console.log(rendered);
        }

        rl.prompt();
    }
}
