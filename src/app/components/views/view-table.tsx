import { Tag, type TagProps } from "@g4rcez/components";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import type { ViewColumn } from "@/store/repositories/entities/view";
import type { Row } from "@/lib/views/engine";

const NOTE_TYPE_THEME: Record<string, TagProps["theme"]> = {
  note: "primary",
  quick: "muted",
  "read-it-later": "info",
  template: "secondary",
  json: "warn",
  freehand: "secondary",
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
        <Link
          to={`/note/${noteId}`}
          className="flex gap-1.5 items-baseline transition-colors duration-300 ease-linear hover:underline text-primary hover:text-primary-hover"
        >
          <LinkIcon className="min-w-3" size={11} />
          {String(value ?? "")}
        </Link>
      );
    }
  }

  if (isNoteField(field, "noteType")) {
    const t = String(value ?? "note");
    return (
      <Tag
        size="small"
        theme={NOTE_TYPE_THEME[t] ?? "neutral"}
        className="rounded-xl"
      >
        {t}
      </Tag>
    );
  }

  if (isNoteField(field, "tags")) {
    const tags = Array.isArray(value) ? (value as string[]) : [];
    if (tags.length === 0) return <span className="text-foreground/30">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Tag key={tag} size="tiny" theme="neutral" className="rounded-xl">
            {tag}
          </Tag>
        ))}
      </div>
    );
  }

  if (isNoteField(field, "favorite")) {
    return value ? (
      <StarIcon size={14} className="text-warn" weight="fill" />
    ) : null;
  }

  if (isNoteField(field, "createdAt") || isNoteField(field, "updatedAt")) {
    return <span>{formatDate(value)}</span>;
  }

  if (isNoteField(field, "content")) {
    const str = String(value ?? "");
    return (
      <span className="text-foreground/60 text-xs truncate max-w-48 block">
        {str.slice(0, 80)}
      </span>
    );
  }

  if (value == null) return <span className="text-foreground/30">—</span>;
  return <span>{String(value)}</span>;
}

type ViewTableProps = {
  rows: Row[];
  columns: ViewColumn[];
};

export function ViewTable({ rows, columns }: ViewTableProps) {
  const displayColumns = useMemo(
    () => (columns.length > 0 ? columns : [{ field: "title", label: "Title" }]),
    [columns],
  );

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-foreground/40 text-sm">
        No results match this query.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {displayColumns.map((col) => (
              <th
                key={col.field}
                className="px-4 py-2 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={(row["notes.id"] as string) ?? `row-${i}`}
              className="border-b border-border/50 hover:bg-card-hover transition-colors"
            >
              {displayColumns.map((col) => (
                <td key={col.field} className="px-4 py-2.5">
                  <CellValue row={row} column={col} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
