---
title: Table
description: Virtualized, sortable, filterable data table with column reordering, grouping, and pagination.
package: "@g4rcez/components"
export: "{ Table, createColumns, useTablePreferences, ColType }"
import: "import { Table, createColumns, useTablePreferences, ColType } from '@g4rcez/components/table'"
category: table
---

# Table

Virtualized, sortable, filterable data table with column reordering, grouping, and pagination.

## Import

```tsx
import { Table, createColumns, useTablePreferences, ColType } from "@g4rcez/components/table";
```

## Props

### Table

| Prop           | Type                               | Default | Description                                                                      |
| -------------- | ---------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `name`         | `string`                           | —       | Unique identifier used to persist user preferences in `localStorage`.            |
| `cols`         | `Col<T>[]`                         | —       | Column definitions produced by `createColumns`.                                  |
| `rows`         | `T[]`                              | —       | Data array to render. Each element maps to a table row.                          |
| `loading`      | `boolean`                          | `false` | Replaces rows with animated skeleton cells while data loads.                     |
| `loadingMore`  | `boolean`                          | `false` | Shows a pulse footer bar for infinite-scroll loading indicators.                 |
| `operations`   | `boolean`                          | `true`  | Toggles the metadata bar (bulk filter, sort, group controls).                    |
| `inlineFilter` | `boolean`                          | `true`  | Enables per-column filter dropdowns in the header row.                           |
| `inlineSorter` | `boolean`                          | `true`  | Enables per-column sort toggles in the header row.                               |
| `sticky`       | `number \| null`                   | —       | `top` offset in px for the sticky header. Pass `null` to disable stickiness.     |
| `Aside`        | `React.FC<CellAsideElement<T>>`    | —       | Component rendered before the first cell in every row (e.g., row-level actions). |
| `pagination`   | `TablePagination`                  | —       | Pagination configuration. When provided, a footer with page controls is shown.   |
| `reference`    | `keyof T`                          | —       | Field used as the stable row key.                                                |
| `useControl`   | `boolean`                          | `false` | When `true`, disables internal filtering/sorting so you can drive it externally. |
| `onScrollEnd`  | `() => void`                       | —       | Called when the user scrolls to the last row (infinite scroll trigger).          |
| `getScrollRef` | `() => HTMLElement \| undefined`   | —       | Returns a custom scroll container instead of `window`.                           |
| `getRowProps`  | `(row: T) => ComponentProps<"tr">` | —       | Merge arbitrary `<tr>` props (e.g., `onClick`, `className`) per row.             |
| `set`          | `(v: TableGetters<T>) => void`     | —       | External callback invoked whenever internal table state changes.                 |

### createColumns

```tsx
createColumns<T>((c) => {
  c.add(id, thead, options?)
  c.remove(id)
  c.filter(predicate)
  c.getAll()
})
```

| Builder method | Signature                                                                 | Description                               |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| `add`          | `(id: AllPaths<T>, thead: ReactNode, options?: ColOptions<T, K>) => void` | Registers a column.                       |
| `remove`       | `(id: AllPaths<T>) => void`                                               | Removes a column by id.                   |
| `filter`       | `(c: (col: Col<T>) => boolean) => Col<T>[]`                               | Filters the column list in-place.         |
| `getAll`       | `() => Col<T>[]`                                                          | Returns a copy of all registered columns. |

### ColOptions

| Option        | Type                                   | Default        | Description                                                                  |
| ------------- | -------------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `type`        | `ColType`                              | `ColType.Text` | Data type (`Text`, `Number`, `Boolean`, `Select`). Affects filter operators. |
| `allowSort`   | `boolean`                              | `true`         | Whether this column can be sorted.                                           |
| `allowFilter` | `boolean`                              | `true`         | Whether this column shows a filter control.                                  |
| `headerLabel` | `string`                               | —              | Overrides the column header text used in the filter/sort metadata bar.       |
| `Element`     | `React.FC<CellPropsElement<T, K>>`     | —              | Custom cell renderer. Receives `{ row, value, rowIndex, matrix, col }`.      |
| `thProps`     | `HTMLAttributes<HTMLTableCellElement>` | —              | Extra props forwarded to the `<th>` element.                                 |
| `cellProps`   | `HTMLAttributes<HTMLTableCellElement>` | —              | Extra props forwarded to each `<td>` element.                                |

### TablePagination

| Field          | Type                                                                    | Description                                                               |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `size`         | `number`                                                                | Current page size.                                                        |
| `pages`        | `number`                                                                | Total number of pages.                                                    |
| `current`      | `number`                                                                | Current page index (1-based).                                             |
| `hasNext`      | `boolean`                                                               | Whether a next page exists.                                               |
| `hasPrevious`  | `boolean`                                                               | Whether a previous page exists.                                           |
| `totalItems`   | `number`                                                                | Total row count across all pages.                                         |
| `sizes`        | `number[]`                                                              | Optional list of selectable page sizes.                                   |
| `onChangeSize` | `(size: number) => void`                                                | Called when the user selects a different page size.                       |
| `asLink`       | `React.FC<{ href: number \| "previous" \| "next"; className: string }>` | Polymorphic page button — supply a router `Link` for deep-linkable pages. |

### useTablePreferences

Persists column order, active filters, sorters, and groups in `localStorage` keyed by `name`.

```tsx
const prefs = useTablePreferences("users-table", columns, options?);
// Spread into <Table {...prefs} rows={data} />
```

| Parameter | Type                       | Description                                                                |
| --------- | -------------------------- | -------------------------------------------------------------------------- |
| `name`    | `string`                   | Storage key (`@components/table-{name}`).                                  |
| `cols`    | `Col<T>[]`                 | Initial column definitions.                                                |
| `options` | `Partial<TableGetters<T>>` | Optional initial state overrides for filters, sorters, groups, pagination. |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                 | CSS Variable         | Purpose                                 |
| --------------------- | -------------------- | --------------------------------------- |
| `bg-table-header`     | `--table-header`     | Column header background                |
| `bg-table-background` | `--table-background` | Table body background                   |
| `border-table-border` | `--table-border`     | Column separator and row divider color  |
| `shadow-shadow-table` | `--shadow-table`     | Table card shadow                       |
| `bg-card-background`  | `--card-background`  | Footer and loading-more bar background  |
| `text-foreground`     | `--foreground`       | Default cell text color                 |
| `text-primary`        | `--primary`          | Active filter / sort accent color       |
| `bg-muted`            | `--muted`            | Hover background for metadata bar items |

The `--table-cell-padding` CSS variable controls cell padding (default `0.75rem`). Override it via `className` on `<Table>`.

## Column Types

| `ColType`         | Enum value  | Filter operators available               |
| ----------------- | ----------- | ---------------------------------------- |
| `ColType.Text`    | `"text"`    | contains, equals, starts with, ends with |
| `ColType.Number`  | `"number"`  | =, ≠, >, <, ≥, ≤                         |
| `ColType.Boolean` | `"boolean"` | is true, is false                        |
| `ColType.Select`  | `"select"`  | equals                                   |

## Examples

### Basic table

```tsx
import { Table, createColumns } from "@g4rcez/components/table";

type User = { id: string; name: string; email: string };

const columns = createColumns<User>((c) => {
    c.add("id", "ID");
    c.add("name", "Name");
    c.add("email", "Email");
});

export function UsersTable({ users }: { users: User[] }) {
    return <Table name="users" cols={columns} rows={users} />;
}
```

### Custom cell renderer

```tsx
import { Table, createColumns, ColType } from "@g4rcez/components/table";
import { Tag } from "@g4rcez/components/tag";

type Product = { sku: string; name: string; price: number; active: boolean };

const columns = createColumns<Product>((c) => {
    c.add("sku", "SKU");
    c.add("name", "Product Name", { allowFilter: true, allowSort: true });
    c.add("price", "Price", {
        type: ColType.Number,
        Element: ({ value }) => (
            <span className="font-mono tabular-nums">{value.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
        ),
    });
    c.add("active", "Status", {
        type: ColType.Boolean,
        Element: ({ value }) => (
            <Tag theme={value ? "success" : "neutral"} size="small">
                {value ? "Active" : "Inactive"}
            </Tag>
        ),
    });
});
```

### Persisted preferences

```tsx
import { Table, createColumns, useTablePreferences } from "@g4rcez/components/table";

const baseColumns = createColumns<Order>((c) => {
    c.add("id", "Order ID");
    c.add("status", "Status");
    c.add("total", "Total");
});

export function OrdersTable({ orders }: { orders: Order[] }) {
    const prefs = useTablePreferences("orders-table", baseColumns);
    return <Table {...prefs} rows={orders} />;
}
```

### Server-side pagination

```tsx
<Table
    name="invoices"
    cols={columns}
    rows={pageData}
    useControl
    pagination={{
        current: page,
        pages: totalPages,
        size: pageSize,
        totalItems: totalCount,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        sizes: [10, 25, 50],
        onChangeSize: setPageSize,
        asLink: ({ href, className, children }) => (
            <a href={`?page=${href}`} className={className}>
                {children}
            </a>
        ),
    }}
/>
```

### Row-level actions with Aside

```tsx
import { TrashIcon, PencilIcon } from "@phosphor-icons/react";

<Table
    name="contacts"
    cols={columns}
    rows={contacts}
    Aside={({ row }) => (
        <div className="flex gap-1">
            <button onClick={() => edit(row)} aria-label="Edit">
                <PencilIcon size={14} />
            </button>
            <button onClick={() => remove(row)} aria-label="Delete" className="hover:text-danger">
                <TrashIcon size={14} />
            </button>
        </div>
    )}
/>;
```

### Infinite scroll

```tsx
<Table name="feed" cols={columns} rows={items} loadingMore={isFetchingNextPage} onScrollEnd={fetchNextPage} />
```

## Do

- Provide a unique `name` to ensure each table has its own isolated `localStorage` slot.
- Use `createColumns` for full TypeScript path inference on deeply nested fields.
- Supply a custom `Element` for cells that need formatting, interactive controls, or icons.
- Use `useTablePreferences` when users should be able to persist their column arrangement across sessions.
- Pass `useControl={true}` and manage data externally when filtering/sorting must happen server-side.
- Use design-token classes for wrapper elements (`bg-table-header`, `bg-table-background`, `border-table-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't render `<Table>` without a `name` — preferences and DOM ids rely on it.
- Don't put heavy rendering logic directly inside `rows` array transformation; use `Element` cells instead so virtualization can skip off-screen rows.
- Don't use `Table` for single-row or trivial datasets — a plain list or card layout is more appropriate.

## Accessibility

- Renders `role="table"`, `role="rowgroup"`, `role="row"`, and `role="columnheader"` for screen-reader semantics.
- Sort state is exposed via `aria-sort="ascending | descending | none"` on each `<th>`.
- Column headers are keyboard-accessible drag targets; column resizing also supports `ArrowLeft`/`ArrowRight` keys (hold `Shift` for larger steps; double-click resets to auto width).
- `aria-busy` on column headers signals loading state to assistive technologies.
- Empty state renders the `Empty` component with a visible placeholder instead of an empty table body.
- Virtualization uses `react-virtuoso` with `useWindowScroll` so native keyboard scrolling and focus management continue to work.

## Data Attributes

- `data-tableheader="{colId}"` — present on every `<th>`, used by the column-resizing logic to update `style.width`.
- `data-resized="true"` — set on a `<th>` after the user manually resizes that column.
- `data-type="resizer"` — identifies the drag handle element within each header cell.

## Notes

- Column reordering uses `motion/react`'s `Reorder.Group` / `Reorder.Item`, so columns animate smoothly to their new positions.
- Internal filtering uses `linq-arrays`. Numeric filters operate on `Number.isNaN`-safe values; empty string filters are skipped.
- `useTablePreferences` merges saved columns back against the current definition so new columns added in code always appear, even if a user has a stale snapshot in storage.
- The `--table-cell-padding` variable can be set per breakpoint by adding it directly to `className`: `className="[--table-cell-padding:0.5rem] @md:[--table-cell-padding:1rem]"`.
- Pass `getScrollRef={getModalScrollerRef}` (exported from the same subpath) when embedding a `Table` inside a `Modal` to fix virtualization scroll detection.
