# JOIN Clauses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add INNER JOIN support to the custom SQL query engine so users can combine data from any two (or more) repository entities in a single query.

**Architecture:** Extend the existing tokenizer/parser/engine pipeline. The engine switches from `Note[]` to `Record<string, unknown>[]` with table-prefixed keys (`notes.title`, `hashtags.hashtag`). A new `DataSources` map feeds entity data into the engine. The hook loads entities on demand from repositories. The table renderer handles generic rows with special formatting for `notes.*` fields.

**Tech Stack:** TypeScript, Vitest (tests), React (hook/components), CodeMirror (autocomplete)

**Spec:** `docs/superpowers/specs/2026-03-27-join-clauses-design.md`

---

## File Structure

- `src/lib/views/ast.ts` — Modify — Add `Join`, `Inner`, `On` token types; `JoinClause`, `JoinCondition` AST nodes; update `Query` type
- `src/lib/views/tokenizer.ts` — Modify — Add `join`, `inner`, `on` to keyword map
- `src/lib/views/parser.ts` — Modify — Parse `FROM <table>`, `[INNER] JOIN <table> ON <col> = <col>`
- `src/lib/views/engine.ts` — Modify — New `DataSources` type, `Row` type, prefixed field resolution, join execution
- `src/lib/views/index.ts` — No change needed (uses `export *`)
- `src/lib/views/__tests__/tokenizer.test.ts` — Modify — Test new tokens
- `src/lib/views/__tests__/parser.test.ts` — Modify — Test JOIN parsing, update existing tests for `from`/`joins` fields
- `src/lib/views/__tests__/engine.test.ts` — Modify — Test JOIN execution with DataSources, update existing tests
- `src/app/hooks/use-view-query.ts` — Modify — Async entity loading, return `Row[]`
- `src/app/components/views/view-table.tsx` — Modify — Accept `Row[]`, generic cell rendering
- `src/app/pages/view-detail.page.tsx` — Modify — Adapt to new hook return type
- `src/app/components/views/query-code-editor.tsx` — Modify — JOIN/ON autocomplete, prefixed field suggestions
- `src/app/components/views/column-picker.tsx` — Modify — Include prefixed fields from joined tables

---

### Task 1: AST types

**Files:** Modify: `src/lib/views/ast.ts`

- [ ] **Step 1: Add new token types to TokenType enum**

In the Keywords section after `From = "From"`, add:

```typescript
Join = "Join",
Inner = "Inner",
On = "On",
```

- [ ] **Step 2: Add JoinCondition and JoinClause types**

After the `OrderByClause` type:

```typescript
export type JoinCondition = {
  type: "JoinCondition";
  left: ColumnRef;
  right: ColumnRef;
};

export type JoinClause = {
  type: "Join";
  table: string;
  on: JoinCondition;
};
```

- [ ] **Step 3: Update the Query type**

```typescript
export type Query = {
  type: "Query";
  select: SelectClause | null;
  from: string | null;
  joins: JoinClause[];
  where: Expression | null;
  orderBy: OrderByClause | null;
  limit: number | null;
};
```

- [ ] **Step 4: Commit**

```
feat(views): add JOIN token types and AST nodes
```

---

### Task 2: Tokenizer keywords

**Files:** Modify: `src/lib/views/tokenizer.ts`, Test: `src/lib/views/__tests__/tokenizer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it("tokenizes JOIN INNER ON keywords", () => {
  const tokens = tokenize("JOIN INNER ON");
  expect(tokens[0]!.type).toBe(TokenType.Join);
  expect(tokens[1]!.type).toBe(TokenType.Inner);
  expect(tokens[2]!.type).toBe(TokenType.On);
  expect(tokens[3]!.type).toBe(TokenType.EOF);
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run src/lib/views/__tests__/tokenizer.test.ts`

- [ ] **Step 3: Add keywords to tokenizer**

In the `KEYWORDS` map after `like`:

```typescript
join: TokenType.Join,
inner: TokenType.Inner,
on: TokenType.On,
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run src/lib/views/__tests__/tokenizer.test.ts`

- [ ] **Step 5: Commit**

```
feat(views): add join/inner/on keywords to tokenizer
```

---

### Task 3: Parser JOIN clauses

**Files:** Modify: `src/lib/views/parser.ts`, Test: `src/lib/views/__tests__/parser.test.ts`

- [ ] **Step 1: Write failing tests**

Update existing empty-query test to expect `from: null, joins: []`:

```typescript
it("parses empty string as empty query", () => {
  const q = parse("");
  expect(q).toEqual({
    type: "Query",
    select: null,
    from: null,
    joins: [],
    where: null,
    orderBy: null,
    limit: null,
  });
});
```

Add new tests:

```typescript
it("parses FROM and stores table name", () => {
  const q = parse("SELECT * FROM notes WHERE title = 'A'");
  expect(q.from).toBe("notes");
  expect(q.joins).toEqual([]);
});

it("parses JOIN clause", () => {
  const q = parse(
    "SELECT notes.title, hashtags.hashtag FROM notes JOIN hashtags ON notes.id = hashtags.filename",
  );
  expect(q.from).toBe("notes");
  expect(q.joins).toHaveLength(1);
  expect(q.joins[0]).toMatchObject({
    type: "Join",
    table: "hashtags",
    on: {
      type: "JoinCondition",
      left: { type: "Column", path: ["notes", "id"] },
      right: { type: "Column", path: ["hashtags", "filename"] },
    },
  });
});

it("parses INNER JOIN as synonym for JOIN", () => {
  const q = parse("FROM notes INNER JOIN tabs ON notes.id = tabs.noteId");
  expect(q.joins).toHaveLength(1);
  expect(q.joins[0]!.table).toBe("tabs");
});

it("parses multiple JOINs", () => {
  const q = parse(
    "FROM notes JOIN hashtags ON notes.id = hashtags.filename JOIN tabs ON notes.id = tabs.noteId",
  );
  expect(q.joins).toHaveLength(2);
  expect(q.joins[0]!.table).toBe("hashtags");
  expect(q.joins[1]!.table).toBe("tabs");
});

it("defaults from to null when absent", () => {
  const q = parse("WHERE title = 'test'");
  expect(q.from).toBeNull();
  expect(q.joins).toEqual([]);
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `npx vitest run src/lib/views/__tests__/parser.test.ts`

- [ ] **Step 3: Update the parser**

In `parser.ts`, update the empty-string return in `parse()`:

```typescript
return { type: "Query", select: null, from: null, joins: [], where: null, orderBy: null, limit: null };
```

Replace the `Parser.parse()` method (keeping the body of `parseSelect`, `parseColumnRef`, etc. unchanged):

```typescript
parse(): Query {
  const query: Query = {
    type: "Query",
    select: null,
    from: null,
    joins: [],
    where: null,
    orderBy: null,
    limit: null,
  };

  if (this.check(TokenType.Select)) {
    query.select = this.parseSelect();
  }

  if (this.check(TokenType.From)) {
    this.advance();
    if (this.check(TokenType.Identifier)) {
      query.from = this.advance().value;
    }
  }

  while (this.check(TokenType.Join) || this.check(TokenType.Inner)) {
    if (this.check(TokenType.Inner)) {
      this.advance();
    }
    this.expect(TokenType.Join);
    const table = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.On);
    const left = this.parseColumnRef();
    this.expect(TokenType.Eq);
    const right = this.parseColumnRef();
    query.joins.push({
      type: "Join",
      table,
      on: { type: "JoinCondition", left, right },
    });
  }

  if (this.check(TokenType.Where)) {
    this.advance();
    query.where = this.parseExpression();
  }

  if (this.check(TokenType.Order)) {
    query.orderBy = this.parseOrderBy();
  }

  if (this.check(TokenType.Limit)) {
    this.advance();
    const num = this.expect(TokenType.Number);
    query.limit = parseFloat(num.value);
  }

  if (!this.check(TokenType.EOF)) {
    const t = this.peek();
    throw new ParseError(`Unexpected token '${t.value}'`, t.position);
  }

  return query;
}
```

Add `TokenType.Join`, `TokenType.Inner`, `TokenType.On` to the imports if needed (they come from `./ast` via the existing import).

- [ ] **Step 4: Run tests, verify PASS**

Run: `npx vitest run src/lib/views/__tests__/parser.test.ts`

- [ ] **Step 5: Commit**

```
feat(views): parse FROM table name and JOIN clauses
```

---

### Task 4: Engine refactor + JOIN execution

**Files:** Modify: `src/lib/views/engine.ts`, Test: `src/lib/views/__tests__/engine.test.ts`

- [ ] **Step 1: Write the new engine**

Replace `src/lib/views/engine.ts` entirely. Key changes from the old engine:
- New types: `Row = Record<string, unknown>`, `DataSources = Record<string, object[]>`
- `prefixRow(tableName, obj)` converts an entity object to prefixed keys
- `resolveField(row, column, fromTable, queryTables)` handles table-qualified and unqualified column refs
- `innerJoin(leftRows, join, dataSources, fromTable, queryTables)` performs nested-loop INNER JOIN
- `executeQuery(query, dataSources)` orchestrates: prefix FROM rows, join, filter, sort, limit
- `evaluateExpression` now takes `(expr, row, fromTable, queryTables)` instead of `(expr, note)`
- All comparison logic (`compareValues`, `coerceDate`, etc.) is unchanged

```typescript
import type {
  ColumnRef,
  ComparisonOp,
  Expression,
  JoinClause,
  LiteralValue,
  Query,
} from "./ast";

export type Row = Record<string, unknown>;
export type DataSources = Record<string, object[]>;

const DEFAULT_TABLE = "notes";

function prefixRow(tableName: string, obj: object): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(obj)) {
    row[`${tableName}.${key}`] = value;
  }
  return row;
}

export function resolveField(
  row: Row,
  column: ColumnRef,
  fromTable: string,
  queryTables: Set<string>,
): unknown {
  const path = column.path;
  let tableName: string;
  let fieldPath: string[];

  if (path.length > 1 && queryTables.has(path[0]!)) {
    tableName = path[0]!;
    fieldPath = path.slice(1);
  } else {
    tableName = fromTable;
    fieldPath = path;
  }

  const key = `${tableName}.${fieldPath[0]}`;
  let value: unknown = row[key];

  for (let i = 1; i < fieldPath.length; i++) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[fieldPath[i]!];
  }

  return value;
}

// --- comparison helpers (unchanged from original) ---

function literalToValue(literal: LiteralValue): string | number | boolean | null {
  switch (literal.type) {
    case "String": return literal.value;
    case "Number": return literal.value;
    case "Boolean": return literal.value;
    case "Null": return null;
  }
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function compareValues(fieldValue: unknown, op: ComparisonOp, literalValue: LiteralValue): boolean {
  const rhs = literalToValue(literalValue);
  if (op === "CONTAINS") {
    if (Array.isArray(fieldValue)) return fieldValue.includes(rhs);
    if (typeof fieldValue === "string" && typeof rhs === "string")
      return fieldValue.toLowerCase().includes(rhs.toLowerCase());
    return false;
  }
  if (op === "STARTS_WITH") {
    if (typeof fieldValue === "string" && typeof rhs === "string")
      return fieldValue.toLowerCase().startsWith(rhs.toLowerCase());
    return false;
  }
  if (op === "LIKE") {
    if (typeof fieldValue === "string" && typeof rhs === "string") {
      const pattern = rhs.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(fieldValue);
    }
    return false;
  }
  if (rhs === null) return op === "=" ? fieldValue == null : fieldValue != null;
  if (fieldValue == null) return op === "!=" ? true : false;
  const fieldDate = coerceDate(fieldValue);
  if (fieldDate && literalValue.type === "String") {
    const rhsDate = coerceDate(rhs);
    if (rhsDate) {
      switch (op) {
        case "=": return fieldDate.getTime() === rhsDate.getTime();
        case "!=": return fieldDate.getTime() !== rhsDate.getTime();
        case ">": return fieldDate > rhsDate;
        case "<": return fieldDate < rhsDate;
        case ">=": return fieldDate >= rhsDate;
        case "<=": return fieldDate <= rhsDate;
      }
    }
  }
  if (typeof fieldValue === "boolean") {
    if (op === "=") return fieldValue === Boolean(rhs);
    if (op === "!=") return fieldValue !== Boolean(rhs);
    return false;
  }
  const lhsNum = typeof fieldValue === "number" ? fieldValue : Number(fieldValue);
  const rhsNum = typeof rhs === "number" ? rhs : Number(rhs);
  if (!isNaN(lhsNum) && !isNaN(rhsNum)) {
    switch (op) {
      case "=": return lhsNum === rhsNum;
      case "!=": return lhsNum !== rhsNum;
      case ">": return lhsNum > rhsNum;
      case "<": return lhsNum < rhsNum;
      case ">=": return lhsNum >= rhsNum;
      case "<=": return lhsNum <= rhsNum;
    }
  }
  const lhsStr = String(fieldValue);
  const rhsStr = String(rhs);
  switch (op) {
    case "=": return lhsStr.toLowerCase() === rhsStr.toLowerCase();
    case "!=": return lhsStr.toLowerCase() !== rhsStr.toLowerCase();
    case ">": return lhsStr > rhsStr;
    case "<": return lhsStr < rhsStr;
    case ">=": return lhsStr >= rhsStr;
    case "<=": return lhsStr <= rhsStr;
  }
}

// --- expression evaluation (updated signature) ---

function evaluateExpression(expr: Expression, row: Row, fromTable: string, queryTables: Set<string>): boolean {
  switch (expr.type) {
    case "BinaryLogical": {
      const left = evaluateExpression(expr.left, row, fromTable, queryTables);
      if (expr.op === "AND") return left && evaluateExpression(expr.right, row, fromTable, queryTables);
      if (expr.op === "OR") return left || evaluateExpression(expr.right, row, fromTable, queryTables);
      return false;
    }
    case "UnaryLogical":
      return !evaluateExpression(expr.expr, row, fromTable, queryTables);
    case "Group":
      return evaluateExpression(expr.expr, row, fromTable, queryTables);
    case "Comparison":
      return compareValues(resolveField(row, expr.field, fromTable, queryTables), expr.op, expr.value);
  }
}

function compareFieldValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const aDate = coerceDate(a);
  const bDate = coerceDate(b);
  if (aDate && bDate) return aDate.getTime() - bDate.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

// --- JOIN ---

function innerJoin(
  leftRows: Row[],
  join: JoinClause,
  dataSources: DataSources,
  fromTable: string,
  queryTables: Set<string>,
): Row[] {
  const rightData = dataSources[join.table] ?? [];
  const rightRows = rightData.map((obj) => prefixRow(join.table, obj));
  const result: Row[] = [];
  for (const left of leftRows) {
    for (const right of rightRows) {
      const merged = { ...left, ...right };
      const leftVal = resolveField(merged, join.on.left, fromTable, queryTables);
      const rightVal = resolveField(merged, join.on.right, fromTable, queryTables);
      if (leftVal != null && rightVal != null && String(leftVal) === String(rightVal)) {
        result.push(merged);
      }
    }
  }
  return result;
}

// --- main entry point ---

export function executeQuery(query: Query, dataSources: DataSources): Row[] {
  const fromTable = query.from ?? DEFAULT_TABLE;
  const queryTables = new Set([fromTable, ...query.joins.map((j) => j.table)]);
  const primaryData = dataSources[fromTable] ?? [];
  let rows: Row[] = primaryData.map((obj) => prefixRow(fromTable, obj));

  for (const join of query.joins) {
    rows = innerJoin(rows, join, dataSources, fromTable, queryTables);
  }

  if (query.where) {
    const where = query.where;
    rows = rows.filter((row) => evaluateExpression(where, row, fromTable, queryTables));
  }

  if (query.orderBy) {
    const { column, direction } = query.orderBy;
    const sign = direction === "DESC" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = resolveField(a, column, fromTable, queryTables);
      const bv = resolveField(b, column, fromTable, queryTables);
      return sign * compareFieldValues(av, bv);
    });
  }

  if (query.limit != null) {
    rows = rows.slice(0, query.limit);
  }

  return rows;
}
```

- [ ] **Step 2: Update existing engine tests to use DataSources + prefixed keys**

Key changes in `engine.test.ts`:
- Add `const dataSources: DataSources = { notes };`
- All `executeQuery(parse("..."), notes)` become `executeQuery(parse("..."), dataSources)`
- All `result[0]!.id` become `result[0]!["notes.id"]`
- All `result[0]!.title` become `result[0]!["notes.title"]`
- All `result[0]!.metadata.author` become `(result[0]!["notes.metadata"] as Record<string, unknown>).author`
- All `result[0]!.tags` become `result[0]!["notes.tags"]`
- Import `type DataSources` from `"../engine"`

- [ ] **Step 3: Add JOIN tests**

Add a new `describe("engine - JOIN")` block:

```typescript
describe("engine - JOIN", () => {
  const hashtags = [
    { id: "h1", hashtag: "#sci-fi", filename: "1", project: "default", createdAt: new Date(), updatedAt: new Date() },
    { id: "h2", hashtag: "#programming", filename: "2", project: "default", createdAt: new Date(), updatedAt: new Date() },
    { id: "h3", hashtag: "#orphan", filename: "999", project: "default", createdAt: new Date(), updatedAt: new Date() },
  ];
  const tabs = [
    { id: "t1", noteId: "1", order: 0, project: "default", createdAt: new Date(), updatedAt: new Date() },
    { id: "t2", noteId: "3", order: 1, project: "default", createdAt: new Date(), updatedAt: new Date() },
  ];
  const joinSources: DataSources = { notes, hashtags, tabs };

  it("joins notes with hashtags", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename"),
      joinSources,
    );
    expect(result).toHaveLength(2);
    expect(result[0]!["notes.title"]).toBe("Dune");
    expect(result[0]!["hashtags.hashtag"]).toBe("#sci-fi");
  });

  it("filters joined results with WHERE", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename WHERE notes.title = 'Dune'"),
      joinSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["hashtags.hashtag"]).toBe("#sci-fi");
  });

  it("sorts joined results", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename ORDER BY notes.title DESC"),
      joinSources,
    );
    expect(result[0]!["notes.title"]).toBe("Clean Code");
  });

  it("limits joined results", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename LIMIT 1"),
      joinSources,
    );
    expect(result).toHaveLength(1);
  });

  it("handles multiple JOINs", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename JOIN tabs ON notes.id = tabs.noteId"),
      joinSources,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!["notes.title"]).toBe("Dune");
    expect(result[0]!["hashtags.hashtag"]).toBe("#sci-fi");
    expect(result[0]!["tabs.id"]).toBe("t1");
  });

  it("returns empty when no rows match the join", () => {
    const result = executeQuery(
      parse("FROM notes JOIN hashtags ON notes.id = hashtags.filename"),
      { notes, hashtags: [{ id: "h1", hashtag: "#none", filename: "nonexistent", project: "", createdAt: new Date(), updatedAt: new Date() }] },
    );
    expect(result).toHaveLength(0);
  });

  it("supports non-notes primary table", () => {
    const projects = [{ id: "default", name: "My Project", createdAt: new Date(), updatedAt: new Date() }];
    const result = executeQuery(
      parse("FROM projects JOIN tabs ON projects.id = tabs.project"),
      { projects, tabs },
    );
    expect(result).toHaveLength(2);
    expect(result[0]!["projects.name"]).toBe("My Project");
  });
});
```

- [ ] **Step 4: Run all tests, verify PASS**

Run: `npx vitest run src/lib/views/__tests__/`

- [ ] **Step 5: Commit**

```
feat(views): engine supports DataSources, prefixed rows, and INNER JOIN
```

---

### Task 5: Hook async entity loading

**Files:** Modify: `src/app/hooks/use-view-query.ts`

- [ ] **Step 1: Rewrite the hook**

Key changes:
- Import `DataSources`, `Row` from engine
- Import `repositories` from `@/store/repositories`
- Add `ENTITY_LOADERS` map for on-demand loading
- Add `loadDataSources(parsed, notes)` async function
- `run()` becomes async, calls `loadDataSources`
- Empty query returns notes wrapped as prefixed Row[]
- Return type changes from `Note[]` to `Row[]`

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { parse } from "@/lib/views/parser";
import { executeQuery, type DataSources, type Row } from "@/lib/views/engine";
import { ParseError, type ColumnRef, type Query } from "@/lib/views/ast";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";

type QueryResult = {
  results: Row[];
  error: ParseError | null;
  timing: number;
  columns: ColumnRef[];
  query: Query | null;
};

const EMPTY: QueryResult = { results: [], error: null, timing: 0, columns: [], query: null };

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

async function loadDataSources(parsed: Query, notes: object[]): Promise<DataSources> {
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

export function useViewQuery(queryString: string, debounceMs = 300): QueryResult {
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
      const columns: ColumnRef[] =
        parsed.select && parsed.select.columns.length > 0 ? parsed.select.columns : [];
      setResult({ results, error: null, timing, columns, query: parsed });
    } catch (e) {
      if (e instanceof ParseError) {
        setResult({ results: [], error: e, timing: 0, columns: [], query: null });
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
        error: null, timing: 0, columns: [], query: null,
      });
      return;
    }
    timerRef.current = setTimeout(() => { run(queryString, notes); }, debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [queryString, notes, debounceMs, run]);

  return result;
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep use-view-query`

- [ ] **Step 3: Commit**

```
feat(views): hook loads DataSources on demand and returns Row[]
```

---

### Task 6: View table generic rendering

**Files:** Modify: `src/app/components/views/view-table.tsx`

- [ ] **Step 1: Rewrite view-table.tsx**

Key changes:
- Props: `notes: Note[]` becomes `rows: Row[]`
- `CellValue` uses `getRowValue(row, field)` which tries direct key then `*.field` fallback
- Note-specific formatting checks both bare and prefixed field names
- Row key uses `row["notes.id"]` or index fallback

```typescript
import { Tag, type TagProps } from "@g4rcez/components";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import type { ViewColumn } from "@/store/repositories/entities/view";
import type { Row } from "@/lib/views/engine";

const NOTE_TYPE_THEME: Record<string, TagProps["theme"]> = {
  note: "primary", quick: "muted", "read-it-later": "info",
  template: "secondary", json: "warn", freehand: "secondary",
};

function formatDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value as string);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function getRowValue(row: Row, field: string): unknown {
  if (field in row) return row[field];
  for (const key of Object.keys(row)) {
    if (key.endsWith(`.${field}`)) return row[key];
  }
  return undefined;
}

function isNoteField(field: string, name: string): boolean {
  return field === name || field === `notes.${name}`;
}

function CellValue({ row, column }: { row: Row; column: ViewColumn }) {
  const value = getRowValue(row, column.field);
  const field = column.field;

  if (isNoteField(field, "title")) {
    const noteId = row["notes.id"] as string | undefined;
    if (noteId) {
      return (
        <Link to={`/note/${noteId}`}
          className="flex gap-1.5 items-baseline transition-colors duration-300 ease-linear hover:underline text-primary hover:text-primary-hover">
          <LinkIcon className="min-w-3" size={11} />
          {String(value ?? "")}
        </Link>
      );
    }
  }
  if (isNoteField(field, "noteType")) {
    const t = String(value ?? "note");
    return <Tag size="small" theme={NOTE_TYPE_THEME[t] ?? "neutral"} className="rounded-xl">{t}</Tag>;
  }
  if (isNoteField(field, "tags")) {
    const tags = Array.isArray(value) ? (value as string[]) : [];
    if (tags.length === 0) return <span className="text-foreground/30">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => <Tag key={tag} size="tiny" theme="neutral" className="rounded-xl">{tag}</Tag>)}
      </div>
    );
  }
  if (isNoteField(field, "favorite")) {
    return value ? <StarIcon size={14} className="text-warn" weight="fill" /> : null;
  }
  if (isNoteField(field, "createdAt") || isNoteField(field, "updatedAt")) {
    return <span>{formatDate(value)}</span>;
  }
  if (isNoteField(field, "content")) {
    const str = String(value ?? "");
    return <span className="text-foreground/60 text-xs truncate max-w-48 block">{str.slice(0, 80)}</span>;
  }
  if (value == null) return <span className="text-foreground/30">—</span>;
  return <span>{String(value)}</span>;
}

type ViewTableProps = { rows: Row[]; columns: ViewColumn[] };

export function ViewTable({ rows, columns }: ViewTableProps) {
  const displayColumns = useMemo(
    () => (columns.length > 0 ? columns : [{ field: "title", label: "Title" }]),
    [columns],
  );
  if (rows.length === 0) {
    return <div className="flex items-center justify-center py-16 text-foreground/40 text-sm">No results match this query.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {displayColumns.map((col) => (
              <th key={col.field} className="px-4 py-2 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={(row["notes.id"] as string) ?? `row-${i}`} className="border-b border-border/50 hover:bg-card-hover transition-colors">
              {displayColumns.map((col) => (
                <td key={col.field} className="px-4 py-2.5"><CellValue row={row} column={col} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep view-table`

- [ ] **Step 3: Commit**

```
feat(views): table renders generic Row[] with note-aware formatting
```

---

### Task 7: View detail page adaptation

**Files:** Modify: `src/app/pages/view-detail.page.tsx`

- [ ] **Step 1: Update prop and add joinedTables**

Change `<ViewTable notes={results} columns={columns} />` to `<ViewTable rows={results} columns={columns} />`.

Add a `joinedTables` memo after `useViewQuery`:

```typescript
const joinedTables = useMemo(() => {
  try {
    const parsed = parse(query);
    const tables: string[] = [];
    if (parsed.from) tables.push(parsed.from);
    for (const j of parsed.joins) tables.push(j.table);
    return tables.length > 1 ? tables : [];
  } catch {
    return [];
  }
}, [query]);
```

Pass to ColumnPicker:

```typescript
<ColumnPicker columns={columns} onChange={handleColumnsChange} metadataKeys={metadataKeys} joinedTables={joinedTables} />
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep view-detail`

- [ ] **Step 3: Commit**

```
feat(views): adapt view detail page to Row[] results and joinedTables
```

---

### Task 8: Autocomplete JOIN/ON keywords

**Files:** Modify: `src/app/components/views/query-code-editor.tsx`

- [ ] **Step 1: Update autocomplete functions**

Replace `resolveTableFields` with `resolveQueryTables` + `resolveFieldSuggestions`. Update `entityQuerySource` to handle `JOIN`/`ON` contexts. Add JOIN/INNER/ON to keyword fallback. Change status text from "note"/"notes" to "result"/"results". Update word matcher regex to include dots: `context.matchBefore(/[\w.]*/)`.

See full code in the spec. Key logic:
- After `FROM` or `JOIN`: suggest table names
- After `ON` or `ON col =`: suggest prefixed fields from all query tables
- In SELECT/WHERE/etc with JOINs: suggest prefixed fields
- Fallback: include JOIN, INNER, ON as keywords

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep query-code-editor`

- [ ] **Step 3: Commit**

```
feat(views): autocomplete for JOIN/ON with prefixed field suggestions
```

---

### Task 9: Column picker prefixed fields

**Files:** Modify: `src/app/components/views/column-picker.tsx`

- [ ] **Step 1: Add joinedTables prop and entity field map**

Add `ENTITY_FIELDS` map with prefixed `ViewColumn` entries per table. Add `joinedTables?: string[]` prop. When `joinedTables` has entries, show prefixed fields from those tables instead of the default note columns.

See full code in the spec.

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep column-picker`

- [ ] **Step 3: Commit**

```
feat(views): column picker shows prefixed fields for JOIN queries
```

---

### Task 10: Full verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Type-check entire project**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No new errors

- [ ] **Step 3: Final commit if any fixes were needed**

```
fix(views): resolve remaining type issues from JOIN implementation
```
