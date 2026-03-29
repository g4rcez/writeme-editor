import { useCallback, useEffect, useRef, useState } from "react";
import { parse } from "@/lib/views/parser";
import { executeQuery, type DataSources, type Row } from "@/lib/views/engine";
import { ParseError, type Query, type SelectItem } from "@/lib/views/ast";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";

type QueryResult = {
  results: Row[];
  error: ParseError | null;
  timing: number;
  columns: SelectItem[];
  query: Query | null;
};

const EMPTY: QueryResult = {
  results: [],
  error: null,
  timing: 0,
  columns: [],
  query: null,
};

const ENTITY_LOADERS: Record<string, (() => Promise<object[]>) | undefined> = {
  hashtags: () => repositories.hashtags.getAll(),
  projects: () => repositories.projects.getAll(),
  tabs: () => repositories.tabs.getAll(),
  noteGroups: () => repositories.noteGroups.getAll(),
  noteGroupMembers: () => repositories.noteGroupMembers.getAll(),
  settings: () => repositories.settings.getAll(),
  scripts: () => repositories.scripts.getAll(),
  views: () => repositories.views.getAll(),
};

async function loadDataSources(
  parsed: Query,
  notes: object[],
): Promise<DataSources> {
  const sources: DataSources = { notes };
  const tables = new Set<string>();
  if (parsed.from && parsed.from !== "notes") tables.add(parsed.from);
  for (const join of parsed.joins) {
    if (join.table !== "notes") tables.add(join.table);
  }
  await Promise.all(
    Array.from(tables).map(async (table) => {
      const loader = ENTITY_LOADERS[table];
      if (loader) sources[table] = await loader();
    }),
  );
  return sources;
}

export function useViewQuery(
  queryString: string,
  debounceMs = 300,
): QueryResult {
  const [state] = useGlobalStore();
  const notes = state.notes;

  const [result, setResult] = useState<QueryResult>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = useCallback(async (qs: string, noteList: object[]) => {
    try {
      const start = performance.now();
      const parsed = parse(qs);
      const dataSources = await loadDataSources(parsed, noteList);
      const results = executeQuery(parsed, dataSources);
      const timing = Math.round(performance.now() - start);

      const columns: SelectItem[] =
        parsed.select && parsed.select.columns.length > 0
          ? parsed.select.columns
          : [];

      setResult({ results, error: null, timing, columns, query: parsed });
    } catch (e) {
      if (e instanceof ParseError) {
        setResult({
          results: [],
          error: e,
          timing: 0,
          columns: [],
          query: null,
        });
      }
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!queryString.trim()) {
      setResult({
        results: notes.map((n) => {
          const row: Row = {};
          for (const [k, v] of Object.entries(n)) row[`notes.${k}`] = v;
          return row;
        }),
        error: null,
        timing: 0,
        columns: [],
        query: null,
      });
      return;
    }
    timerRef.current = setTimeout(() => {
      run(queryString, notes);
    }, debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [queryString, notes, debounceMs, run]);

  return result;
}
