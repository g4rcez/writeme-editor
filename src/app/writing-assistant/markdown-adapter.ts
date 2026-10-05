import type { Html, Node, Root, Text } from "mdast";
import { isolateHistory } from "@codemirror/commands";
import {
    EditorState,
    RangeSetBuilder,
    StateEffect,
    StateField,
    type Extension,
    type Transaction as CodeMirrorTransaction,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type {
    WritingCategory,
    WritingEditorAdapter,
    WritingScope,
    WritingSegment,
    WritingSelectionRange,
    WritingSnapshot,
    WritingSuggestion,
} from "./types";
import { createWritingSegments, type WritingTextRange } from "./segments";

const MARKDOWN_SPELLCHECK_REFRESH_CHARACTERS = new Set("`~#$%&*+-/:;<=>@[]\\^_|{}\r\n()");
const MARKDOWN_SPELLCHECK_INTERIOR_REFRESH_CHARACTERS = new Set([
    "`",
    "~",
    "$",
    "<",
    ">",
    "|",
    "\r",
    "\n",
    ":",
    "/",
    ".",
    "-",
    "!",
    "[",
    "]",
    "(",
    ")",
]);

function containsSpellcheckRefreshCharacter(value: string, characters: ReadonlySet<string>): boolean {
    for (const character of value) {
        if (characters.has(character)) return true;
    }
    return false;
}

type TextSelection = {
    from: number;
    to: number;
};

type TextSpan = {
    from: number;
    to: number;
};

const markdownParser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml", "toml"])
    .use(remarkMath, { singleDollarTextMath: true });

const PROSE_NODE_TYPES: Record<string, true> = {
    root: true,
    paragraph: true,
    heading: true,
    blockquote: true,
    list: true,
    listItem: true,
    table: true,
    tableRow: true,
    tableCell: true,
    emphasis: true,
    strong: true,
    delete: true,
    text: true,
};
const VOID_HTML_ELEMENTS: Record<string, true> = {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true,
};

function getPosition(node: Node, sourceLength: number): TextSpan | null {
    const from = node.position?.start.offset;
    const to = node.position?.end.offset;

    if (
        typeof from !== "number" ||
        typeof to !== "number" ||
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        to <= from ||
        to > sourceLength
    ) {
        return null;
    }

    return { from, to };
}

type OpenHtmlTag = {
    name: string;
    from: number;
};

type HtmlTagToken = {
    name: string;
    from: number;
    to: number;
    closing: boolean;
    selfClosing: boolean;
};

function findInlineHtmlSpans(block: Node, source: string): TextSpan[] {
    const tokens: HtmlTagToken[] = [];
    visit(block, "html", (node: Html) => {
        const position = getPosition(node, source.length);
        if (!position || source.slice(position.from, position.to) !== node.value || node.value.includes("\n")) return;

        const tagPattern = /<!--[\s\S]*?-->|<\/?([a-z][a-z\d:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/giu;
        for (const match of node.value.matchAll(tagPattern)) {
            if (match.index === undefined || match[1] === undefined) continue;
            const tokenFrom = position.from + match.index;
            tokens.push({
                name: (match[1] ?? "").toLowerCase(),
                from: tokenFrom,
                to: tokenFrom + match[0].length,
                closing: match[0].startsWith("</"),
                selfClosing: /\/\s*>$/u.test(match[0]),
            });
        }
    });

    const openTags: OpenHtmlTag[] = [];
    const spans: TextSpan[] = [];
    for (const token of tokens) {
        if (token.closing) {
            for (let index = openTags.length - 1; index >= 0; index -= 1) {
                const openTag = openTags[index];
                if (openTag?.name !== token.name) continue;
                openTags.splice(index, 1);
                spans.push({ from: openTag.from, to: token.to });
                break;
            }
        } else if (!token.selfClosing && VOID_HTML_ELEMENTS[token.name] !== true) {
            openTags.push({ name: token.name, from: token.from });
        }
    }

    const blockPosition = getPosition(block, source.length);
    if (blockPosition) {
        for (const openTag of openTags) {
            if (openTag.from < blockPosition.to) spans.push({ from: openTag.from, to: blockPosition.to });
        }
    }

    return spans;
}

function trimUrlPunctuation(text: string, from: number, initialTo: number): number {
    let to = initialTo;
    while (to > from && /[.,!?;:]/u.test(text[to - 1] ?? "")) {
        to -= 1;
    }

    const bracketPairs = [
        ["(", ")"],
        ["[", "]"],
        ["{", "}"],
    ] as const;

    let trimming = true;
    while (trimming && to > from) {
        trimming = false;
        const last = text[to - 1];
        for (const [opening, closing] of bracketPairs) {
            if (last !== closing) continue;

            let openingCount = 0;
            let closingCount = 0;
            for (let index = from; index < to; index += 1) {
                if (text[index] === opening) openingCount += 1;
                if (text[index] === closing) closingCount += 1;
            }
            if (closingCount > openingCount) {
                to -= 1;
                trimming = true;
            }
            break;
        }
    }

    return to;
}

function mergeSpans(spans: TextSpan[]): TextSpan[] {
    spans.sort((left, right) => left.from - right.from || left.to - right.to);

    const merged: TextSpan[] = [];
    for (const span of spans) {
        const previous = merged[merged.length - 1];
        if (previous && span.from <= previous.to) {
            previous.to = Math.max(previous.to, span.to);
        } else {
            merged.push({ ...span });
        }
    }

    return merged;
}

function findExcludedTextSpans(text: string): TextSpan[] {
    const spans: TextSpan[] = [];
    const urlOrEmailPattern =
        /(?:\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`]+|\bmailto:[^\s<>"'`]+|\bwww\.[^\s<>"'`]+|\b[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+|\b(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s<>"'`]+)?)/giu;

    for (const match of text.matchAll(urlOrEmailPattern)) {
        const from = match.index;
        if (from === undefined) continue;

        const initialTo = from + match[0].length;
        const isEmail =
            /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/iu.test(
                match[0],
            );
        const to = isEmail ? initialTo : trimUrlPunctuation(text, from, initialTo);
        if (from < to) spans.push({ from, to });
    }

    const wikiLinkPattern = /!?\[\[[\s\S]*?\]\]/gu;
    for (const match of text.matchAll(wikiLinkPattern)) {
        const from = match.index;
        if (from !== undefined) spans.push({ from, to: from + match[0].length });
    }

    return mergeSpans(spans);
}

function hasValidSelection(selection: TextSelection, sourceLength: number): boolean {
    return (
        Number.isInteger(selection.from) &&
        Number.isInteger(selection.to) &&
        selection.from >= 0 &&
        selection.from < selection.to &&
        selection.to <= sourceLength
    );
}

function getMarkdownWritingRanges(source: string, selection?: TextSelection): WritingTextRange[] {
    if (selection && !hasValidSelection(selection, source.length)) return [];

    const tree = markdownParser.parse(source) as Root;
    const nonProseSpans: TextSpan[] = [];
    visit(tree, (node) => {
        if (PROSE_NODE_TYPES[node.type] !== true) {
            const position = getPosition(node, source.length);
            if (position) nonProseSpans.push(position);
        }
    });

    const literalSpans = findExcludedTextSpans(source);
    const ranges: WritingTextRange[] = [];
    const appendTextLeaf = (node: Text): void => {
        const position = getPosition(node, source.length);
        if (!position || source.slice(position.from, position.to) !== node.value) return;
        if (nonProseSpans.some((span) => span.from <= position.from && span.to >= position.to)) return;

        const excludedSpans = literalSpans
            .filter((span) => span.from < position.to && span.to > position.from)
            .map((span) => ({
                from: Math.max(span.from, position.from) - position.from,
                to: Math.min(span.to, position.to) - position.from,
            }));
        let cursor = 0;
        const appendSafeRun = (from: number, to: number): void => {
            let clippedFrom = position.from + from;
            let clippedTo = position.from + to;
            if (selection) {
                clippedFrom = Math.max(clippedFrom, selection.from);
                clippedTo = Math.min(clippedTo, selection.to);
            }
            if (clippedFrom >= clippedTo) return;

            const leafFrom = clippedFrom - position.from;
            const leafTo = clippedTo - position.from;
            ranges.push({
                text: node.value.slice(leafFrom, leafTo),
                from: clippedFrom,
                to: clippedTo,
            });
        };

        for (const span of excludedSpans) {
            appendSafeRun(cursor, span.from);
            cursor = span.to;
        }
        appendSafeRun(cursor, node.value.length);
    };

    visit(tree, ["paragraph", "heading", "tableCell"], (block) => {
        nonProseSpans.push(...findInlineHtmlSpans(block, source));
        visit(block, "text", (node) => appendTextLeaf(node));
    });

    return ranges;
}

export function extractMarkdownWritingSegments(source: string, selection?: TextSelection): WritingSegment[] {
    return createWritingSegments(getMarkdownWritingRanges(source, selection));
}

function getMarkdownWritingScopeRange(
    source: string,
    position: number,
    scope: "paragraph" | "line",
): TextSelection | null {
    if (scope === "line") {
        const from = source.lastIndexOf("\n", position - 1) + 1;
        const nextNewline = source.indexOf("\n", position);
        return { from, to: nextNewline === -1 ? source.length : nextNewline };
    }

    let range: TextSpan | null = null;
    visit(markdownParser.parse(source) as Root, ["paragraph", "heading"], (node) => {
        const candidate = getPosition(node, source.length);
        if (candidate && candidate.from <= position && position <= candidate.to) range = candidate;
    });
    return range;
}

function getMarkdownSpellcheckExcludedRanges(source: string): TextSpan[] {
    const ranges = getMarkdownWritingRanges(source);
    const excluded: TextSpan[] = [];
    let cursor = 0;

    for (const range of ranges) {
        if (range.to <= cursor) continue;
        if (range.from > cursor) excluded.push({ from: cursor, to: range.from });
        cursor = Math.max(cursor, range.to);
    }
    if (cursor < source.length) excluded.push({ from: cursor, to: source.length });
    return excluded;
}

type MarkdownWritingIssue = {
    suggestion: WritingSuggestion;
    from: number;
    to: number;
    segmentFrom: number;
    segmentTo: number;
};

type MarkdownWritingState = {
    issues: MarkdownWritingIssue[];
    activeId: string | null;
    statusMessage: string | null;
    decorations: DecorationSet;
    spellcheckDecorations: DecorationSet;
};

type MarkdownWritingEffect = StateEffect<unknown>;

const STALE_WRITING_MESSAGE = "Text changed. Review again.";
const COMMONMARK_ESCAPABLE_PUNCTUATION = new Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");

function isWritingCategory(value: unknown): value is WritingCategory {
    return value === "spelling" || value === "grammar" || value === "clarity" || value === "enhancement";
}

function isCodePointBoundary(text: string, offset: number): boolean {
    if (offset <= 0 || offset >= text.length) return true;

    const before = text.charCodeAt(offset - 1);
    const after = text.charCodeAt(offset);
    return !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff);
}

function escapeMarkdownReplacement(text: string): string {
    let escaped = "";
    for (const character of text) {
        if (COMMONMARK_ESCAPABLE_PUNCTUATION.has(character)) escaped += "\\";
        escaped += character;
    }
    return escaped;
}

function notifyWritingListeners(listeners: Set<() => void>): void {
    for (const listener of listeners) listener();
}

/** Create the CodeMirror extension and per-view adapter for one raw editor. */
export function createMarkdownWritingAssistant(): {
    extension: Extension;
    createAdapter: (view: EditorView) => WritingEditorAdapter;
} {
    let revision = 0;
    const listeners = new Set<() => void>();
    const documentListeners = new Set<() => void>();
    const selectionListeners = new Set<() => void>();

    const setReviewEffect = StateEffect.define<MarkdownWritingIssue[]>();
    const clearReviewEffect = StateEffect.define<null>();
    const activateSuggestionEffect = StateEffect.define<string | null>();
    const dismissSuggestionEffect = StateEffect.define<string>();
    const acceptSegmentEffect = StateEffect.define<string>();
    const staleSegmentEffect = StateEffect.define<string>();

    const buildSpellcheckDecorations = (source: string): DecorationSet => {
        const builder = new RangeSetBuilder<Decoration>();
        for (const range of getMarkdownSpellcheckExcludedRanges(source)) {
            builder.add(range.from, range.to, Decoration.mark({ attributes: { spellcheck: "false" } }));
        }
        return builder.finish();
    };
    const shouldRefreshSpellcheckDecorations = (
        transaction: CodeMirrorTransaction,
        decorations: DecorationSet,
    ): boolean => {
        const oldDoc = transaction.startState.doc;
        let shouldRefresh = false;
        transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            const insertedText = inserted.toString();
            const deletedText = oldDoc.sliceString(fromA, toA);
            const queryFrom = Math.max(0, fromA - 1);
            const queryTo = Math.min(oldDoc.length, Math.max(fromA, toA) + 1);
            let insideExcludedRange = false;
            let touchesExcludedBoundary = false;

            if (queryFrom < queryTo) {
                decorations.between(queryFrom, queryTo, (rangeFrom, rangeTo) => {
                    if (fromA > rangeFrom && toA < rangeTo) insideExcludedRange = true;
                    if ((fromA <= rangeFrom && rangeFrom <= toA) || (fromA <= rangeTo && rangeTo <= toA)) {
                        touchesExcludedBoundary = true;
                    }
                });
            }

            if (touchesExcludedBoundary) {
                shouldRefresh = true;
                return;
            }
            const refreshCharacters = insideExcludedRange
                ? MARKDOWN_SPELLCHECK_INTERIOR_REFRESH_CHARACTERS
                : MARKDOWN_SPELLCHECK_REFRESH_CHARACTERS;
            if (
                containsSpellcheckRefreshCharacter(insertedText, refreshCharacters) ||
                containsSpellcheckRefreshCharacter(deletedText, refreshCharacters)
            ) {
                shouldRefresh = true;
                return;
            }

            if (!insideExcludedRange) {
                const context = oldDoc.sliceString(queryFrom, queryTo);
                if (/\b(?:https?:\/\/|www\.)|[a-z0-9-]+\.[a-z]{2,}/i.test(context + insertedText)) {
                    shouldRefresh = true;
                }
            }
        });
        return shouldRefresh;
    };

    const buildDecorations = (
        issues: readonly MarkdownWritingIssue[],
        spellcheckDecorations: DecorationSet,
    ): DecorationSet => {
        if (issues.length === 0) return spellcheckDecorations;

        const suggestions = issues.map((issue) =>
            Decoration.mark({
                class: `cm-writing-assistant-suggestion cm-writing-assistant-${issue.suggestion.category}`,
                attributes: {
                    "data-writing-suggestion-id": issue.suggestion.id,
                    "data-writing-suggestion-category": issue.suggestion.category,
                    "aria-label": `${issue.suggestion.category} suggestion`,
                },
            }).range(issue.from, issue.to),
        );
        return spellcheckDecorations.update({ add: suggestions, sort: true });
    };

    const reviewStateField = StateField.define<MarkdownWritingState>({
        create: (state) => {
            const spellcheckDecorations = buildSpellcheckDecorations(state.doc.toString());
            return {
                issues: [],
                activeId: null,
                statusMessage: null,
                decorations: spellcheckDecorations,
                spellcheckDecorations,
            };
        },
        update(state, transaction) {
            let issues = state.issues;
            let activeId = state.activeId;
            let statusMessage = state.statusMessage;
            let stateChanged = transaction.docChanged;
            const spellcheckDecorations = !transaction.docChanged
                ? state.spellcheckDecorations
                : shouldRefreshSpellcheckDecorations(transaction, state.spellcheckDecorations)
                  ? buildSpellcheckDecorations(transaction.state.doc.toString())
                  : state.spellcheckDecorations.map(transaction.changes);

            let acceptedSegmentId: string | null = null;
            for (const effect of transaction.effects) {
                if (effect.is(acceptSegmentEffect)) acceptedSegmentId = effect.value;
            }

            if (transaction.docChanged && state.issues.length > 0) {
                const changedRanges: { from: number; to: number }[] = [];
                transaction.changes.iterChanges((fromA, toA) => {
                    changedRanges.push({ from: fromA, to: toA });
                });

                const mappedIssues: MarkdownWritingIssue[] = [];
                let removedIssue = false;
                let removedStaleIssue = false;
                let movedIssue = false;
                for (const issue of state.issues) {
                    if (acceptedSegmentId === issue.suggestion.segmentId) {
                        removedIssue = true;
                        continue;
                    }

                    let segmentTouched = false;
                    for (const change of changedRanges) {
                        if (change.from <= issue.segmentTo && change.to >= issue.segmentFrom) {
                            segmentTouched = true;
                            break;
                        }
                    }
                    if (segmentTouched) {
                        removedIssue = true;
                        removedStaleIssue = true;
                        continue;
                    }

                    const from = transaction.changes.mapPos(issue.from);
                    const to = transaction.changes.mapPos(issue.to);
                    const segmentFrom = transaction.changes.mapPos(issue.segmentFrom);
                    const segmentTo = transaction.changes.mapPos(issue.segmentTo);
                    const issueMoved =
                        from !== issue.from ||
                        to !== issue.to ||
                        segmentFrom !== issue.segmentFrom ||
                        segmentTo !== issue.segmentTo;
                    if (issueMoved) {
                        movedIssue = true;
                        mappedIssues.push({ ...issue, from, to, segmentFrom, segmentTo });
                    } else {
                        mappedIssues.push(issue);
                    }
                }

                if (removedIssue || movedIssue) {
                    issues = mappedIssues;
                    stateChanged = true;
                }
                if (removedStaleIssue) {
                    statusMessage = STALE_WRITING_MESSAGE;
                    stateChanged = true;
                }
                if (activeId !== null && !mappedIssues.some((issue) => issue.suggestion.id === activeId)) {
                    activeId = null;
                    stateChanged = true;
                }
            }

            for (const effect of transaction.effects) {
                if (effect.is(setReviewEffect)) {
                    issues = effect.value;
                    activeId = null;
                    statusMessage = null;
                    stateChanged = true;
                } else if (effect.is(clearReviewEffect)) {
                    issues = [];
                    activeId = null;
                    statusMessage = null;
                    stateChanged = true;
                } else if (effect.is(activateSuggestionEffect)) {
                    if (
                        effect.value !== null &&
                        issues.some((issue) => issue.suggestion.id === effect.value) &&
                        activeId !== effect.value
                    ) {
                        activeId = effect.value;
                        stateChanged = true;
                    }
                } else if (effect.is(dismissSuggestionEffect)) {
                    const remainingIssues = issues.filter((issue) => issue.suggestion.id !== effect.value);
                    if (remainingIssues.length !== issues.length) {
                        issues = remainingIssues;
                        if (activeId === effect.value) activeId = null;
                        stateChanged = true;
                    }
                } else if (effect.is(staleSegmentEffect)) {
                    const remainingIssues = issues.filter((issue) => issue.suggestion.segmentId !== effect.value);
                    if (remainingIssues.length !== issues.length) {
                        issues = remainingIssues;
                        if (activeId !== null && !remainingIssues.some((issue) => issue.suggestion.id === activeId)) {
                            activeId = null;
                        }
                        stateChanged = true;
                    }
                    if (statusMessage !== STALE_WRITING_MESSAGE) {
                        statusMessage = STALE_WRITING_MESSAGE;
                        stateChanged = true;
                    }
                }
            }
            if (!stateChanged) return state;
            return {
                issues,
                activeId,
                statusMessage,
                spellcheckDecorations,
                decorations: buildDecorations(issues, spellcheckDecorations),
            };
        },
        provide: (field) => EditorView.decorations.from(field, (state) => state.decorations),
    });

    const extension: Extension = [
        reviewStateField,
        EditorView.updateListener.of((update) => {
            if (update.docChanged) revision += 1;

            const previousState = update.startState.field(reviewStateField);
            const nextState = update.state.field(reviewStateField);
            if (
                previousState.issues !== nextState.issues ||
                previousState.activeId !== nextState.activeId ||
                previousState.statusMessage !== nextState.statusMessage
            ) {
                notifyWritingListeners(listeners);
            }
            if (update.docChanged) notifyWritingListeners(documentListeners);
            if (update.selectionSet) notifyWritingListeners(selectionListeners);
        }),
        EditorView.domEventHandlers({
            click(event, view) {
                if (!(event.target instanceof Element)) return false;
                const markedElement = event.target.closest<HTMLElement>("[data-writing-suggestion-id]");
                const id = markedElement?.dataset.writingSuggestionId;
                if (!id || !view.state.field(reviewStateField).issues.some((issue) => issue.suggestion.id === id)) {
                    return false;
                }

<<<<<<< Updated upstream
                view.dispatch({ effects: activateSuggestionEffect.of(id) });
                return false;
||||||| Stash base
  const createAdapter = (view: EditorView): WritingEditorAdapter => {
    const dispatchEffect = (effect: MarkdownWritingEffect): void => {
      if (adapterDisposed) return;
      view.dispatch({ effects: effect });
    };
    const readState = (): MarkdownWritingState => view.state.field(reviewStateField);
    const isEditable = (): boolean =>
      !adapterDisposed && !view.state.facet(EditorState.readOnly) && view.state.facet(EditorView.editable);

    const adapter: WritingEditorAdapter = {
      snapshot(scope: WritingScope): WritingSnapshot {
        const source = view.state.doc.toString();
        const selection = view.state.selection.main;
        const segments =
          scope === "selection" && selection.from < selection.to
            ? extractMarkdownWritingSegments(source, { from: selection.from, to: selection.to })
            : scope === "selection"
              ? []
              : extractMarkdownWritingSegments(source);
        return { revision, segments };
      },
      show(suggestions: WritingSuggestion[], snapshot: WritingSnapshot): void {
        if (adapterDisposed || snapshot.revision !== revision) return;

        const source = view.state.doc.toString();
        const eligibleSegments = extractMarkdownWritingSegments(source);
        const segmentsById = new Map<string, WritingSegment>();
        for (const segment of snapshot.segments) {
          if (!segmentsById.has(segment.id)) segmentsById.set(segment.id, segment);
        }

        const candidates: { issue: MarkdownWritingIssue; order: number }[] = [];
        const usedIds = new Set<string>();
        for (const [order, suggestion] of suggestions.entries()) {
          if (
            !suggestion.id ||
            usedIds.has(suggestion.id) ||
            !isWritingCategory(suggestion.category) ||
            !Number.isInteger(suggestion.from) ||
            !Number.isInteger(suggestion.to) ||
            suggestion.from < 0 ||
            suggestion.from >= suggestion.to ||
            !suggestion.original ||
            suggestion.replacement === suggestion.original ||
            /[\r\n\0]/u.test(suggestion.replacement)
          ) {
            continue;
          }
          usedIds.add(suggestion.id);

          const segment = segmentsById.get(suggestion.segmentId);
          if (!segment || suggestion.to > segment.text.length) continue;
          if (
            !isCodePointBoundary(segment.text, suggestion.from) ||
            !isCodePointBoundary(segment.text, suggestion.to) ||
            segment.from < 0 ||
            segment.to > source.length ||
            segment.to - segment.from !== segment.text.length ||
            source.slice(segment.from, segment.to) !== segment.text
          ) {
            continue;
          }
          const isCurrentProse = eligibleSegments.some(
            (eligible) =>
              segment.from >= eligible.from &&
              segment.to <= eligible.to &&
              source.slice(segment.from, segment.to) === segment.text,
          );
          if (!isCurrentProse) continue;

          const from = segment.from + suggestion.from;
          const to = segment.from + suggestion.to;
          if (source.slice(from, to) !== suggestion.original) continue;

          candidates.push({
            issue: {
              suggestion: { ...suggestion },
              from,
              to,
              segmentFrom: segment.from,
              segmentTo: segment.to,
=======
  const createAdapter = (view: EditorView): WritingEditorAdapter => {
    adapterDisposed = false;
    const dispatchEffect = (effect: MarkdownWritingEffect): void => {
      if (adapterDisposed) return;
      view.dispatch({ effects: effect });
    };
    const readState = (): MarkdownWritingState => view.state.field(reviewStateField);
    const isEditable = (): boolean =>
      !adapterDisposed && !view.state.facet(EditorState.readOnly) && view.state.facet(EditorView.editable);

    const adapter: WritingEditorAdapter = {
      snapshot(scope: WritingScope): WritingSnapshot {
        const source = view.state.doc.toString();
        const selection = view.state.selection.main;
        const segments =
          scope === "selection" && selection.from < selection.to
            ? extractMarkdownWritingSegments(source, { from: selection.from, to: selection.to })
            : scope === "selection"
              ? []
              : extractMarkdownWritingSegments(source);
        return { revision, segments };
      },
      show(suggestions: WritingSuggestion[], snapshot: WritingSnapshot): void {
        if (adapterDisposed || snapshot.revision !== revision) return;

        const source = view.state.doc.toString();
        const eligibleSegments = extractMarkdownWritingSegments(source);
        const segmentsById = new Map<string, WritingSegment>();
        for (const segment of snapshot.segments) {
          if (!segmentsById.has(segment.id)) segmentsById.set(segment.id, segment);
        }

        const candidates: { issue: MarkdownWritingIssue; order: number }[] = [];
        const usedIds = new Set<string>();
        for (const [order, suggestion] of suggestions.entries()) {
          if (
            !suggestion.id ||
            usedIds.has(suggestion.id) ||
            !isWritingCategory(suggestion.category) ||
            !Number.isInteger(suggestion.from) ||
            !Number.isInteger(suggestion.to) ||
            suggestion.from < 0 ||
            suggestion.from >= suggestion.to ||
            !suggestion.original ||
            suggestion.replacement === suggestion.original ||
            /[\r\n\0]/u.test(suggestion.replacement)
          ) {
            continue;
          }
          usedIds.add(suggestion.id);

          const segment = segmentsById.get(suggestion.segmentId);
          if (!segment || suggestion.to > segment.text.length) continue;
          if (
            !isCodePointBoundary(segment.text, suggestion.from) ||
            !isCodePointBoundary(segment.text, suggestion.to) ||
            segment.from < 0 ||
            segment.to > source.length ||
            segment.to - segment.from !== segment.text.length ||
            source.slice(segment.from, segment.to) !== segment.text
          ) {
            continue;
          }
          const isCurrentProse = eligibleSegments.some(
            (eligible) =>
              segment.from >= eligible.from &&
              segment.to <= eligible.to &&
              source.slice(segment.from, segment.to) === segment.text,
          );
          if (!isCurrentProse) continue;

          const from = segment.from + suggestion.from;
          const to = segment.from + suggestion.to;
          if (source.slice(from, to) !== suggestion.original) continue;

          candidates.push({
            issue: {
              suggestion: { ...suggestion },
              from,
              to,
              segmentFrom: segment.from,
              segmentTo: segment.to,
>>>>>>> Stashed changes
            },
        }),
    ];

    const createAdapter = (view: EditorView): WritingEditorAdapter => {
        let adapterDisposed = false;
        const dispatchEffect = (effect: MarkdownWritingEffect): void => {
            if (adapterDisposed) return;
            view.dispatch({ effects: effect });
        };
        const readState = (): MarkdownWritingState => view.state.field(reviewStateField);
        const isEditable = (): boolean =>
            !adapterDisposed && !view.state.facet(EditorState.readOnly) && view.state.facet(EditorView.editable);

        const adapter: WritingEditorAdapter = {
            snapshot(scope: WritingScope, selectedRange?: WritingSelectionRange): WritingSnapshot {
                const source = view.state.doc.toString();
                const selection = view.state.selection.main;
                const range =
                    scope === "selection"
                        ? (selectedRange ??
                          (selection.from < selection.to ? { from: selection.from, to: selection.to } : undefined))
                        : scope === "paragraph" || scope === "line"
                          ? getMarkdownWritingScopeRange(source, selection.head, scope)
                          : undefined;
                const segments =
                    scope === "note"
                        ? extractMarkdownWritingSegments(source)
                        : range
                          ? extractMarkdownWritingSegments(source, range)
                          : [];
                return { revision, segments };
            },
            show(suggestions: WritingSuggestion[], snapshot: WritingSnapshot): void {
                if (adapterDisposed || snapshot.revision !== revision) return;

                const source = view.state.doc.toString();
                const eligibleSegments = extractMarkdownWritingSegments(source);
                const segmentsById = new Map<string, WritingSegment>();
                for (const segment of snapshot.segments) {
                    if (!segmentsById.has(segment.id)) segmentsById.set(segment.id, segment);
                }

                const candidates: { issue: MarkdownWritingIssue; order: number }[] = [];
                const usedIds = new Set<string>();
                for (const [order, suggestion] of suggestions.entries()) {
                    if (
                        !suggestion.id ||
                        usedIds.has(suggestion.id) ||
                        !isWritingCategory(suggestion.category) ||
                        !Number.isInteger(suggestion.from) ||
                        !Number.isInteger(suggestion.to) ||
                        suggestion.from < 0 ||
                        suggestion.from >= suggestion.to ||
                        !suggestion.original ||
                        suggestion.replacement === suggestion.original ||
                        /[\r\n\0]/u.test(suggestion.replacement)
                    ) {
                        continue;
                    }
                    usedIds.add(suggestion.id);

                    const segment = segmentsById.get(suggestion.segmentId);
                    if (!segment || suggestion.to > segment.text.length) continue;
                    if (
                        !isCodePointBoundary(segment.text, suggestion.from) ||
                        !isCodePointBoundary(segment.text, suggestion.to) ||
                        segment.from < 0 ||
                        segment.to > source.length ||
                        segment.to - segment.from !== segment.text.length ||
                        source.slice(segment.from, segment.to) !== segment.text
                    ) {
                        continue;
                    }
                    const isCurrentProse = eligibleSegments.some(
                        (eligible) =>
                            segment.from >= eligible.from &&
                            segment.to <= eligible.to &&
                            source.slice(segment.from, segment.to) === segment.text,
                    );
                    if (!isCurrentProse) continue;

                    const from = segment.from + suggestion.from;
                    const to = segment.from + suggestion.to;
                    if (source.slice(from, to) !== suggestion.original) continue;

                    candidates.push({
                        issue: {
                            suggestion: { ...suggestion },
                            from,
                            to,
                            segmentFrom: segment.from,
                            segmentTo: segment.to,
                        },
                        order,
                    });
                }

                candidates.sort(
                    (left, right) =>
                        left.issue.from - right.issue.from ||
                        left.issue.to - right.issue.to ||
                        left.order - right.order,
                );
                const acceptedIssues: MarkdownWritingIssue[] = [];
                let previousTo = -1;
                for (const candidate of candidates) {
                    if (candidate.issue.from < previousTo) continue;
                    acceptedIssues.push(candidate.issue);
                    previousTo = candidate.issue.to;
                }
                dispatchEffect(setReviewEffect.of(acceptedIssues));
            },
            clear(): void {
                dispatchEffect(clearReviewEffect.of(null));
            },
            reveal(id: string): void {
                if (adapterDisposed) return;
                const issue = readState().issues.find((candidate) => candidate.suggestion.id === id);
                if (!issue) return;
                view.dispatch({
                    effects: [activateSuggestionEffect.of(id), EditorView.scrollIntoView(issue.from, { y: "center" })],
                });
            },
            focus(): void {
                if (!adapterDisposed) view.focus();
            },
            accept(id: string): boolean {
                if (!isEditable()) return false;
                const issue = readState().issues.find((candidate) => candidate.suggestion.id === id);
                if (!issue) return false;

                const source = view.state.doc.toString();
                const eligibleSegments = extractMarkdownWritingSegments(source);
                const sourceMatches = source.slice(issue.from, issue.to) === issue.suggestion.original;
                const proseRangeIsEligible = eligibleSegments.some(
                    (segment) => issue.from >= segment.from && issue.to <= segment.to,
                );
                if (!sourceMatches || !proseRangeIsEligible) {
                    dispatchEffect(staleSegmentEffect.of(issue.suggestion.segmentId));
                    return false;
                }

                view.dispatch({
                    changes: {
                        from: issue.from,
                        to: issue.to,
                        insert: escapeMarkdownReplacement(issue.suggestion.replacement),
                    },
                    effects: acceptSegmentEffect.of(issue.suggestion.segmentId),
                    annotations: isolateHistory.of("full"),
                });
                return true;
            },
            dismiss(id: string): void {
                if (readState().issues.some((issue) => issue.suggestion.id === id)) {
                    dispatchEffect(dismissSuggestionEffect.of(id));
                }
            },
            getSuggestions(): readonly WritingSuggestion[] {
                return readState().issues.map((issue) => issue.suggestion);
            },
            getActiveSuggestionId(): string | null {
                return readState().activeId;
            },
            getStatusMessage(): string | null {
                return readState().statusMessage;
            },
            isEditable,
            subscribe(listener: () => void): () => void {
                if (adapterDisposed) return () => {};
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            subscribeDocument(listener: () => void): () => void {
                if (adapterDisposed) return () => {};
                documentListeners.add(listener);
                return () => documentListeners.delete(listener);
            },
            subscribeSelection(listener: () => void): () => void {
                if (adapterDisposed) return () => {};
                selectionListeners.add(listener);
                return () => selectionListeners.delete(listener);
            },
            dispose(): void {
                if (adapterDisposed) return;
                adapterDisposed = true;
                view.dispatch({ effects: clearReviewEffect.of(null) });
                listeners.clear();
                documentListeners.clear();
                selectionListeners.clear();
            },
        };

        return adapter;
    };

    return { extension, createAdapter };
}
