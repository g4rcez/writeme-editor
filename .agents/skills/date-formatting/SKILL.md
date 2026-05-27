---
name: date-formatting
description: Use whenever displaying, formatting, or outputting dates in this codebase — including createdAt, updatedAt, lastSynced, or any other Date value shown in UI components, tables, dialogs, or lists. Trigger on any date rendering decision, especially when reaching for .toLocaleDateString(), .toLocaleString(), or Intl.DateTimeFormat for display purposes.
---

# Date Formatting

## Rule

All dates displayed to the user must use `Dates.yearMonthDay()` from `@/lib/dates`. Never use locale-dependent methods like `.toLocaleDateString()` or `.toLocaleString()` for display — they produce inconsistent output across locales (e.g. "3/30/2026" vs "30/03/2026").

## Usage

```ts
import { Dates } from "@/lib/dates";

// Date object
Dates.yearMonthDay(note.createdAt)          // "2026-03-30"

// String field (repository returns strings for date columns)
Dates.yearMonthDay(new Date(note.updatedAt)) // "2026-03-30"

// Combined date + time
`${Dates.yearMonthDay(d)} ${Dates.time(d)}`  // "2026-03-30 14:22"
```

## Available formatters in `Dates`

| Method | Output | Use for |
|---|---|---|
| `Dates.yearMonthDay(d)` | `2026-03-30` | Any date-only display |
| `Dates.isoDate(d)` | `2026-03-30` | Same as above (aliases) |
| `Dates.time(d)` | `14:22` | Time-only display |

Both `yearMonthDay` and `isoDate` produce identical output — prefer `yearMonthDay` in UI and `isoDate` in filenames/exports.

## What to avoid

```ts
// BAD — locale-dependent
new Date(note.updatedAt).toLocaleDateString()
d.toLocaleDateString()
d.toLocaleString()

// BAD — verbose, reinvents what Dates already does
format(d, "yyyy-MM-dd")  // use Dates.yearMonthDay(d) instead
```

## When the value might be a string

Repository date fields come back as strings from SQLite. Always wrap before formatting:

```ts
Dates.yearMonthDay(new Date(row.createdAt))
```

If the value might be null/undefined, guard first:

```ts
row.lastSynced ? Dates.yearMonthDay(new Date(row.lastSynced)) : "—"
```
