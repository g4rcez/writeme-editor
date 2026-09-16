import { opendir, readFile } from "node:fs/promises";
import path from "node:path";
import { FILE_SEARCH_RESULT_LIMIT, type FileSearchEntry } from "../types/tree";

type FileSearchOptions = {
    rootPath: string;
    query: string;
    signal: AbortSignal;
    onBatch: (entries: FileSearchEntry[]) => void | Promise<void>;
};

export type FileSearchSummary = {
    cancelled: boolean;
    truncated: boolean;
};

type IgnoreRule = {
    basePath: string;
    directoryOnly: boolean;
    negated: boolean;
    anchored: boolean;
    hasSlash: boolean;
    pattern: string;
};

const SEARCH_BATCH_INTERVAL_MS = 32;
const SEARCH_BATCH_SIZE = 64;
const DEFAULT_IGNORED_DIRECTORIES = new Set([
    ".git",
    ".next",
    ".vite",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
]);
const isDefaultIgnoredPath = (relativePath: string): boolean =>
    relativePath.split("/").some((segment) => DEFAULT_IGNORED_DIRECTORIES.has(segment));

const globPatternMatches = (pattern: string, value: string): boolean => {
    const memo = new Map<string, boolean>();

    const match = (patternIndex: number, valueIndex: number): boolean => {
        const key = `${patternIndex}:${valueIndex}`;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;

        if (patternIndex >= pattern.length) {
            const result = valueIndex >= value.length;
            memo.set(key, result);
            return result;
        }

        const character = pattern[patternIndex];
        let result: boolean;

        if (character === "*") {
            let nextPatternIndex = patternIndex + 1;
            while (pattern[nextPatternIndex] === "*") nextPatternIndex += 1;

            if (pattern[nextPatternIndex] === "/") {
                result =
                    match(nextPatternIndex + 1, valueIndex) ||
                    match(nextPatternIndex, valueIndex) ||
                    (valueIndex < value.length && match(patternIndex, valueIndex + 1));
            } else {
                result =
                    match(nextPatternIndex, valueIndex) ||
                    (valueIndex < value.length && match(patternIndex, valueIndex + 1));
            }
        } else if (character === "?") {
            result = valueIndex < value.length && value[valueIndex] !== "/" && match(patternIndex + 1, valueIndex + 1);
        } else if (character === "[") {
            const closingIndex = pattern.indexOf("]", patternIndex + 1);
            if (closingIndex <= patternIndex + 1 || valueIndex >= value.length || value[valueIndex] === "/") {
                result =
                    valueIndex < value.length &&
                    value[valueIndex] === character &&
                    match(patternIndex + 1, valueIndex + 1);
            } else {
                const classStart = patternIndex + 1;
                const classEnd =
                    pattern[classStart] === "!" || pattern[classStart] === "^" ? classStart + 1 : classStart;
                const isNegatedClass = classEnd !== classStart;
                const currentValue = value[valueIndex];
                let classMatches = false;

                for (let classIndex = classEnd; classIndex < closingIndex; classIndex += 1) {
                    const rangeStartValue = pattern[classIndex];
                    const rangeEndValue = pattern[classIndex + 2];
                    if (
                        classIndex + 2 < closingIndex &&
                        pattern[classIndex + 1] === "-" &&
                        rangeEndValue !== "]" &&
                        rangeStartValue !== undefined &&
                        rangeEndValue !== undefined &&
                        currentValue !== undefined
                    ) {
                        const rangeStart = rangeStartValue.charCodeAt(0);
                        const rangeEnd = rangeEndValue.charCodeAt(0);
                        const valueCode = currentValue.charCodeAt(0);
                        classMatches ||= valueCode >= rangeStart && valueCode <= rangeEnd;
                        classIndex += 2;
                    } else {
                        classMatches ||= currentValue === rangeStartValue;
                    }
                }

                result = (isNegatedClass ? !classMatches : classMatches) && match(closingIndex + 1, valueIndex + 1);
            }
        } else if (character === "\\" && pattern[patternIndex + 1]) {
            result =
                valueIndex < value.length &&
                value[valueIndex] === pattern[patternIndex + 1] &&
                match(patternIndex + 2, valueIndex + 1);
        } else {
            result =
                valueIndex < value.length && value[valueIndex] === character && match(patternIndex + 1, valueIndex + 1);
        }

        memo.set(key, result);
        return result;
    };

    return match(0, 0);
};

const trimTrailingSpaces = (value: string): string => {
    let end = value.length;
    while (end > 0 && value[end - 1] === " " && value[end - 2] !== "\\") end -= 1;
    return value.slice(0, end);
};

const parseIgnoreRules = (content: string, basePath: string): IgnoreRule[] => {
    const rules: IgnoreRule[] = [];

    for (const rawLine of content.split(/\r?\n/u)) {
        let line = trimTrailingSpaces(rawLine);
        if (!line) continue;

        if (line.startsWith("\\#") || line.startsWith("\\!")) {
            line = line.slice(1);
        } else if (line.startsWith("#")) {
            continue;
        }

        let negated = false;
        if (line.startsWith("!")) {
            negated = true;
            line = line.slice(1);
        }

        if (!line) continue;

        const directoryOnly = line.endsWith("/") && !line.endsWith("\\/");
        if (directoryOnly) line = line.slice(0, -1);

        const anchored = line.startsWith("/");
        line = line.replace(/^\/+/, "");
        if (!line) continue;

        rules.push({
            anchored,
            basePath,
            directoryOnly,
            hasSlash: line.includes("/"),
            negated,
            pattern: line,
        });
    }

    return rules;
};

const getCandidatePrefixes = (candidate: string): string[] => {
    const segments = candidate.split("/");
    return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
};

const matchesIgnoreRule = (rule: IgnoreRule, relativePath: string, isDirectory: boolean): boolean => {
    const basePrefix = rule.basePath ? `${rule.basePath}/` : "";
    if (!relativePath.startsWith(basePrefix)) return false;

    const candidate = relativePath.slice(basePrefix.length);
    if (!candidate) return false;

    if (!rule.hasSlash && !rule.anchored) {
        const segments = candidate.split("/");
        return segments.some(
            (segment, index) =>
                globPatternMatches(rule.pattern, segment) &&
                (!rule.directoryOnly || isDirectory || index < segments.length - 1),
        );
    }

    const candidates = rule.directoryOnly ? getCandidatePrefixes(candidate) : [candidate];
    return candidates.some(
        (value) =>
            globPatternMatches(rule.pattern, value) && (!rule.directoryOnly || isDirectory || value !== candidate),
    );
};

type GitignoreMatcher = IgnoreRule[];

const addIgnoreRules = (matcher: GitignoreMatcher, content: string, basePath: string): void => {
    matcher.push(...parseIgnoreRules(content, basePath));
};

const isIgnored = (matcher: GitignoreMatcher, relativePath: string, isDirectory: boolean): boolean => {
    let ignored = false;
    for (const rule of matcher) {
        if (matchesIgnoreRule(rule, relativePath, isDirectory)) ignored = !rule.negated;
    }
    return ignored;
};

type DirectorySearchJob = {
    path: string;
    relativePath: string;
    inheritedMatcher: GitignoreMatcher;
};

const loadDirectoryMatcher = async ({
    directoryPath,
    inheritedMatcher,
    relativePath,
}: {
    directoryPath: string;
    inheritedMatcher: GitignoreMatcher;
    relativePath: string;
}): Promise<GitignoreMatcher> => {
    try {
        const content = await readFile(path.join(directoryPath, ".gitignore"), "utf8");
        const matcher = [...inheritedMatcher];
        addIgnoreRules(matcher, content, relativePath);
        return matcher;
    } catch {
        return inheritedMatcher;
    }
};

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const createFileSearchEntry = (
    rootPath: string,
    relativePath: string,
    type: FileSearchEntry["type"],
): FileSearchEntry => {
    const entryPath = path.join(rootPath, ...relativePath.split("/"));
    return {
        extension: type === "file" ? path.extname(entryPath).toLowerCase() : undefined,
        name: path.basename(entryPath),
        path: entryPath,
        relativePath,
        type,
    };
};

export const searchWorkspaceFiles = async ({
    onBatch,
    query,
    rootPath,
    signal,
}: FileSearchOptions): Promise<FileSearchSummary> => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || signal.aborted) return { cancelled: signal.aborted, truncated: false };

    const batch: FileSearchEntry[] = [];
    const directoryJobs: DirectorySearchJob[] = [{ path: rootPath, relativePath: "", inheritedMatcher: [] }];
    let lastBatchAt = 0;
    let resultCount = 0;
    let truncated = false;

    const flushBatch = async (force = false): Promise<void> => {
        if (batch.length === 0) return;
        if (!force && batch.length < SEARCH_BATCH_SIZE && Date.now() - lastBatchAt < SEARCH_BATCH_INTERVAL_MS) return;
        if (signal.aborted) {
            batch.length = 0;
            return;
        }
        const entries = batch.splice(0, batch.length);
        await onBatch(entries);
        lastBatchAt = Date.now();
        await yieldToEventLoop();
    };

    while (directoryJobs.length > 0 && !truncated) {
        if (signal.aborted) return { cancelled: true, truncated: false };

        const job = directoryJobs.pop();
        if (!job) break;

        const matcher = await loadDirectoryMatcher({
            directoryPath: job.path,
            inheritedMatcher: job.inheritedMatcher,
            relativePath: job.relativePath,
        });
        if (signal.aborted) return { cancelled: true, truncated: false };

        try {
            const directory = await opendir(job.path);
            for await (const entry of directory) {
                if (signal.aborted) return { cancelled: true, truncated: false };
                if (entry.name.startsWith(".")) continue;

                const relativePath = job.relativePath ? `${job.relativePath}/${entry.name}` : entry.name;
                if (isDefaultIgnoredPath(relativePath) || isIgnored(matcher, relativePath, entry.isDirectory())) {
                    continue;
                }

                const isDirectory = entry.isDirectory();
                if (isDirectory) {
                    directoryJobs.push({
                        path: path.join(job.path, entry.name),
                        relativePath,
                        inheritedMatcher: matcher,
                    });
                }

                if ((!isDirectory && !entry.isFile()) || !relativePath.toLowerCase().includes(normalizedQuery)) {
                    continue;
                }

                batch.push(createFileSearchEntry(rootPath, relativePath, isDirectory ? "directory" : "file"));
                resultCount += 1;
                if (batch.length >= SEARCH_BATCH_SIZE) await flushBatch(true);

                if (resultCount >= FILE_SEARCH_RESULT_LIMIT) {
                    truncated = true;
                    break;
                }
            }
        } catch (error) {
            if (!job.relativePath) throw error;
        }

        await flushBatch();
        await yieldToEventLoop();
    }

    await flushBatch(true);
    return { cancelled: false, truncated };
};
