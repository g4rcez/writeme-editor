import { useEffect, useRef } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  sql,
  keywordCompletionSource,
  StandardSQL,
} from "@codemirror/lang-sql";
import {
  acceptCompletion,
  autocompletion,
  completionKeymap,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { catppuccinMocha } from "@catppuccin/codemirror";
import { useGlobalStore } from "@/store/global.store";
import type { ParseError } from "@/lib/views/ast";

type QueryCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error: ParseError | null;
  resultCount: number | null;
  timing: number;
};

const ENTITY_SCHEMA: Record<string, string[]> = {
  notes: [
    "title",
    "content",
    "id",
    "project",
    "tags",
    "noteType",
    "url",
    "description",
    "favicon",
    "metadata",
    "favorite",
    "createdAt",
    "updatedAt",
    "filePath",
    "fileSize",
    "lastSynced",
    "createdBy",
    "updatedBy",
  ],
  hashtags: ["id", "hashtag", "filename", "project", "createdAt", "updatedAt"],
  projects: ["id", "name", "createdAt", "updatedAt"],
  tabs: ["id", "noteId", "order", "project", "createdAt", "updatedAt"],
  noteGroups: ["id", "title", "description", "createdAt", "updatedAt"],
  noteGroupMembers: [
    "id",
    "groupId",
    "noteId",
    "order",
    "createdAt",
    "updatedAt",
  ],
  settings: ["id", "name", "value", "createdAt", "updatedAt"],
  scripts: ["id", "name", "content", "createdAt", "updatedAt"],
  ai: ["id", "adapterId", "name", "createdAt", "updatedAt"],
  views: [
    "id",
    "title",
    "query",
    "columns",
    "viewType",
    "sortField",
    "sortDirection",
    "viewConfig",
    "createdAt",
    "updatedAt",
  ],
};

const TABLE_NAMES = Object.keys(ENTITY_SCHEMA);
const CUSTOM_OPERATORS = ["CONTAINS", "STARTS_WITH", "LIKE"];
const JOIN_KEYWORDS = ["JOIN", "INNER", "ON", "AS", "GROUP"];
const AGGREGATE_FNS = ["COUNT", "SUM", "AVG", "MIN", "MAX"];

/** Returns all table names referenced in the query (FROM + JOINs). */
function resolveQueryTables(fullText: string): string[] {
  const tables: string[] = [];
  const fromMatch = /\bFROM\s+(\w+)/i.exec(fullText);
  if (fromMatch) {
    const t = fromMatch[1]!.toLowerCase();
    if (ENTITY_SCHEMA[t]) tables.push(t);
  }
  const joinRe = /\bJOIN\s+(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = joinRe.exec(fullText)) !== null) {
    const t = m[1]!.toLowerCase();
    if (ENTITY_SCHEMA[t]) tables.push(t);
  }
  return tables.length > 0 ? tables : ["notes"];
}

/** Returns prefixed field suggestions for all query tables. */
function resolvePrefixedFields(tables: string[]): string[] {
  const fields: string[] = [];
  for (const table of tables) {
    for (const field of ENTITY_SCHEMA[table] ?? []) {
      fields.push(`${table}.${field}`);
    }
  }
  return fields;
}

function entityQuerySource(
  context: CompletionContext,
): CompletionResult | null {
  // Match word chars plus dots (for prefixed fields like notes.title)
  const word = context.matchBefore(/[\w.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const textBefore = context.state.doc.sliceString(0, word.from).trimEnd();
  const textBeforeUpper = textBefore.toUpperCase();
  const fullText = context.state.doc.toString();

  // After FROM or JOIN: suggest table names
  if (/\b(?:FROM|JOIN)\s*$/.test(textBeforeUpper)) {
    return {
      from: word.from,
      options: TABLE_NAMES.map((t) => ({ label: t, type: "type" })),
    };
  }

  // After ON or ON col =: suggest prefixed fields from all query tables
  if (
    /\bON\s*$/.test(textBeforeUpper) ||
    /\bON\s+[\w.]+\s*=\s*$/.test(textBeforeUpper)
  ) {
    const tables = resolveQueryTables(fullText);
    return {
      from: word.from,
      options: resolvePrefixedFields(tables).map((f) => ({
        label: f,
        type: "property",
      })),
    };
  }

  // After GROUP BY: suggest fields
  if (
    /\bGROUP\s+BY\s*$/.test(textBeforeUpper) ||
    /\bGROUP\s+BY\s+[\w.,\s]+,\s*$/.test(textBeforeUpper)
  ) {
    const tables = resolveQueryTables(fullText);
    const hasJoin = /\bJOIN\b/i.test(fullText);
    const options = hasJoin
      ? resolvePrefixedFields(tables).map((f) => ({
          label: f,
          type: "property" as const,
        }))
      : (ENTITY_SCHEMA[tables[0]!] ?? ENTITY_SCHEMA.notes!).map((f) => ({
          label: f,
          type: "property" as const,
        }));
    return { from: word.from, options };
  }

  // In SELECT/WHERE/AND/OR/NOT/ORDER BY/comma: suggest fields + aggregate functions
  if (
    /(?:\bSELECT|\bWHERE|\bAND|\bOR\b|\bNOT|\bORDER\s+BY|,)\s*$/.test(
      textBeforeUpper,
    )
  ) {
    const tables = resolveQueryTables(fullText);
    const hasJoin = /\bJOIN\b/i.test(fullText);
    const fieldOptions = hasJoin
      ? resolvePrefixedFields(tables).map((f) => ({
          label: f,
          type: "property" as const,
        }))
      : (ENTITY_SCHEMA[tables[0]!] ?? ENTITY_SCHEMA.notes!).map((f) => ({
          label: f,
          type: "property" as const,
        }));
    const isSelect =
      /\bSELECT\b/i.test(textBeforeUpper) || /,\s*$/.test(textBefore);
    const aggOptions = isSelect
      ? AGGREGATE_FNS.map((fn) => ({
          label: fn + "(",
          type: "function" as const,
        }))
      : [];
    return { from: word.from, options: [...fieldOptions, ...aggOptions] };
  }

  return {
    from: word.from,
    options: [
      ...CUSTOM_OPERATORS.map((op) => ({ label: op, type: "keyword" })),
      ...JOIN_KEYWORDS.map((kw) => ({ label: kw, type: "keyword" })),
    ],
  };
}

const BASE_THEME = EditorView.theme({
  "&": { fontFamily: "inherit" },
  ".cm-content": {
    minHeight: "7rem",
    padding: "1rem",
    whiteSpace: "pre",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.875rem",
    lineHeight: "1.5",
  },
  ".cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
});

export function QueryCodeEditor({
  value,
  onChange,
  error,
  resultCount,
  timing,
}: QueryCodeEditorProps) {
  const [state] = useGlobalStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const isDark = state.theme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          minimalSetup,
          sql(),
          autocompletion({
            override: [
              keywordCompletionSource(StandardSQL, false),
              entityQuerySource,
            ],
          }),
          keymap.of([
            { key: "Tab", run: acceptCompletion },
            ...completionKeymap,
          ]),
          isDark ? catppuccinMocha : [],
          BASE_THEME,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isDark]);

  // Sync external value changes (e.g. visual filter → SQL)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-md border border-border bg-card-background"
      />
      <div className="flex items-center gap-2 text-xs">
        {error ? (
          <span className="text-danger">
            ✗ {error.message}
            {error.position > 0 && ` (position ${error.position})`}
          </span>
        ) : resultCount !== null ? (
          <span className="text-success">
            ✓ {resultCount} {resultCount === 1 ? "result" : "results"} matched
            {timing > 0 && ` · ${timing}ms`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
