# JOIN Clauses for Views Query Engine

## Summary

Add INNER JOIN support to the custom SQL query engine so users can query across all repository entities (notes, hashtags, projects, tabs, noteGroups, noteGroupMembers, settings, scripts, ai, views) and combine them in a single result set.

## Requirements

- Full cross-entity queries: any entity can be the primary table, any entity can be joined
- INNER JOIN only (LEFT/RIGHT JOIN deferred to future work)
- Table-prefixed field names in results (`notes.title`, `hashtags.hashtag`) to avoid collisions
- Note-specific rendering preserved for `notes.*` fields (title as link, noteType as tag, etc.)
- Data loaded on demand from repositories — only entities referenced in the query are fetched
- Backward compatible: queries without JOIN still work, unqualified field names resolve against the FROM table

## Syntax

```sql
-- Basic JOIN
SELECT notes.title, hashtags.hashtag
FROM notes
JOIN hashtags ON notes.id = hashtags.filename
WHERE notes.noteType = 'note'
ORDER BY notes.title ASC
LIMIT 50

-- Multiple JOINs
SELECT notes.title, hashtags.hashtag, tabs.order
FROM notes
JOIN hashtags ON notes.id = hashtags.filename
JOIN tabs ON notes.id = tabs.noteId

-- Non-notes primary table
SELECT projects.name, tabs.noteId
FROM projects
JOIN tabs ON projects.id = tabs.project
```

## Design

### 1. AST & Tokenizer

**New token types**: `Join`, `Inner`, `On`

**New AST nodes**:

```ts
type JoinClause = {
  type: "Join";
  table: string;
  on: JoinCondition;
};

type JoinCondition = {
  type: "JoinCondition";
  left: ColumnRef;
  right: ColumnRef;
};
```

**Query AST changes**:

```ts
type Query = {
  type: "Query";
  select: SelectClause | null;
  from: string | null;          // NEW: primary table name
  joins: JoinClause[];          // NEW: joined tables
  where: Expression | null;
  orderBy: OrderByClause | null;
  limit: number | null;
};
```

Column references (`ColumnRef.path`) support table-qualified names: `["notes", "title"]` for `notes.title`. Unqualified `["title"]` resolves against the FROM table.

### 2. Parser

After parsing FROM, the parser enters a loop consuming `[INNER] JOIN <table> ON <col> = <col>` clauses. The `INNER` keyword is optional (`JOIN` alone means INNER JOIN).

The ON condition only supports equality: `left_col = right_col`. Both sides must be table-qualified column references.

### 3. Engine

**Signature change**: `executeQuery(query, dataSources)` where:

```ts
type DataSources = Record<string, Record<string, unknown>[]>;
```

**Execution pipeline**:

1. **Resolve FROM**: get `dataSources[query.from]`, prefix all keys with `tableName.`
2. **Execute JOINs**: for each JoinClause, nested-loop join left rows x right rows. Match on ON condition (equality check on prefixed field values). Merge matching pairs into a single row.
3. **WHERE**: filter merged rows using prefixed field resolution
4. **ORDER BY**: sort by prefixed field
5. **LIMIT**: slice result
6. **Return**: `Record<string, unknown>[]`

**Field resolution**: Updated `resolveField` handles both:
- Prefixed keys on merged rows: `row["notes.title"]`
- Unqualified keys resolved against FROM table: `title` → `row["notes.title"]` when FROM is `notes`

**Backward compatibility**: When there are no JOINs, the engine still wraps rows with table prefixes and returns `Record<string, unknown>[]`. The old `Note[]` return type is replaced everywhere. When FROM is absent (e.g. `WHERE title = 'foo'`), the engine defaults to `notes` as the primary table — same as current behavior.

### 4. Hook (`use-view-query.ts`)

- Parses the query, then inspects `query.from` and `query.joins` to determine required entities
- Loads only referenced entities from `repositories` via `getAll()`
- Notes come from the global store (already loaded); other entities are fetched on demand
- Return type: `results: Record<string, unknown>[]`

### 5. Table Rendering (`view-table.tsx`)

- Props: `notes: Note[]` → `rows: Record<string, unknown>[]`
- Cell rendering checks field prefix:
  - `notes.title` → clickable link (uses `row["notes.id"]` for the URL)
  - `notes.noteType` → colored tag
  - `notes.tags` → tag array
  - `notes.favorite` → star icon
  - `notes.createdAt` / `notes.updatedAt` → formatted date
  - `notes.content` → truncated text
  - Everything else → `String(value)` or dash
- Field resolution: direct key lookup `row[column.field]`

### 6. Autocomplete (`query-code-editor.tsx`)

- `JOIN`, `INNER`, `ON` added as keyword completions
- After `JOIN` keyword: suggest table names (all entity names from `ENTITY_SCHEMA`)
- After `ON`: suggest prefixed fields from tables in the query (FROM table + all JOINed tables)
- In SELECT/WHERE/ORDER BY with a JOIN query: suggest prefixed fields (`notes.title`, `hashtags.hashtag`)

### 7. Column Picker

When a JOIN query is active, the column picker includes prefixed fields from all joined tables as available columns.

## Files Modified

- `src/lib/views/ast.ts` — new token types, JoinClause/JoinCondition types, Query.from/joins fields
- `src/lib/views/tokenizer.ts` — add join/inner/on keywords
- `src/lib/views/parser.ts` — parse JOIN clauses after FROM
- `src/lib/views/engine.ts` — new DataSources type, join execution, prefixed field resolution
- `src/lib/views/index.ts` — export new types
- `src/app/hooks/use-view-query.ts` — async entity loading, new return type
- `src/app/components/views/view-table.tsx` — generic row rendering
- `src/app/components/views/query-code-editor.tsx` — JOIN/ON autocomplete
- `src/app/pages/view-detail.page.tsx` — adapt to new result type
- `src/app/components/views/column-picker.tsx` — prefixed field suggestions

## Testing

- New unit tests in `src/lib/views/__tests__/` for JOIN parsing, execution, and field resolution
- Manual verification: create views with JOIN queries, verify table renders correctly
- Backward compatibility: existing queries without JOIN must produce identical results
