import { Button, Input, Select } from "@g4rcez/components";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useMemo } from "react";
import type { ComparisonOp } from "@/lib/views/ast";
import type { FilterRow, FilterGroup } from "@/lib/views/query-builder";
import type { Note } from "@/store/note";
import { useGlobalStore } from "@/store/global.store";

const BUILTIN_FIELDS: { value: string; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "content", label: "Content" },
  { value: "noteType", label: "Note Type" },
  { value: "tags", label: "Tags" },
  { value: "favorite", label: "Favorite" },
  { value: "createdAt", label: "Created At" },
  { value: "updatedAt", label: "Updated At" },
  { value: "description", label: "Description" },
  { value: "url", label: "URL" },
  { value: "fileSize", label: "File Size" },
];

type FieldType = "string" | "number" | "date" | "boolean" | "array";

function getFieldType(field: string): FieldType {
  if (field === "favorite") return "boolean";
  if (field === "fileSize") return "number";
  if (field === "createdAt" || field === "updatedAt") return "date";
  if (field === "tags") return "array";
  return "string";
}

const OPERATORS_BY_TYPE: Record<
  FieldType,
  { value: ComparisonOp; label: string }[]
> = {
  string: [
    { value: "=", label: "equals" },
    { value: "!=", label: "not equals" },
    { value: "CONTAINS", label: "contains" },
    { value: "STARTS_WITH", label: "starts with" },
    { value: "LIKE", label: "matches (LIKE)" },
  ],
  number: [
    { value: "=", label: "=" },
    { value: "!=", label: "≠" },
    { value: ">", label: ">" },
    { value: "<", label: "<" },
    { value: ">=", label: "≥" },
    { value: "<=", label: "≤" },
  ],
  date: [
    { value: ">", label: "after" },
    { value: "<", label: "before" },
    { value: ">=", label: "on or after" },
    { value: "<=", label: "on or before" },
    { value: "=", label: "on" },
  ],
  boolean: [{ value: "=", label: "is" }],
  array: [{ value: "CONTAINS", label: "contains" }],
};

type FilterBuilderProps = {
  group: FilterGroup;
  onChange: (group: FilterGroup) => void;
};

function useMetadataFields(notes: Note[]): { value: string; label: string }[] {
  return useMemo(() => {
    const keys = new Set<string>();
    for (const note of notes) {
      if (note.metadata) {
        for (const key of Object.keys(note.metadata)) {
          keys.add(key);
        }
      }
    }
    return Array.from(keys).map((k) => ({
      value: `metadata.${k}`,
      label: `metadata.${k}`,
    }));
  }, [notes]);
}

export function FilterBuilder({ group, onChange }: FilterBuilderProps) {
  const [state] = useGlobalStore();
  const metadataFields = useMetadataFields(state.notes);
  const allFields = [...BUILTIN_FIELDS, ...metadataFields];

  const updateRow = (id: string, patch: Partial<FilterRow>) => {
    onChange({
      ...group,
      filters: group.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const removeRow = (id: string) => {
    onChange({ ...group, filters: group.filters.filter((f) => f.id !== id) });
  };

  const addRow = () => {
    const newRow: FilterRow = {
      id: crypto.randomUUID(),
      field: "title",
      operator: "CONTAINS",
      value: "",
    };
    onChange({ ...group, filters: [...group.filters, newRow] });
  };

  const toggleLogic = () => {
    onChange({ ...group, logic: group.logic === "AND" ? "OR" : "AND" });
  };

  return (
    <div className="flex flex-col gap-3">
      {group.filters.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <span>Match</span>
          <button
            type="button"
            onClick={toggleLogic}
            className="rounded px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground"
          >
            {group.logic}
          </button>
          <span>of the following conditions:</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {group.filters.map((row) => {
          const fieldType = getFieldType(row.field);
          const operators = OPERATORS_BY_TYPE[fieldType];
          const currentOp = operators.find((o) => o.value === row.operator)
            ? row.operator
            : operators[0]!.value;

          return (
            <div key={row.id} className="flex items-center gap-2">
              <Select
                hiddenLabel
                title="Field"
                name={`field-${row.id}`}
                value={row.field}
                onChange={(e) => {
                  const newField = e.target.value;
                  const newType = getFieldType(newField);
                  const newOps = OPERATORS_BY_TYPE[newType];
                  updateRow(row.id, {
                    field: newField,
                    operator: newOps[0]!.value,
                  });
                }}
                options={allFields.map((f) => ({
                  value: f.value,
                  label: f.label,
                }))}
                className="min-w-32"
              />
              <Select
                hiddenLabel
                title="Operator"
                name={`op-${row.id}`}
                value={currentOp}
                onChange={(e) =>
                  updateRow(row.id, {
                    operator: e.target.value as ComparisonOp,
                  })
                }
                options={operators.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                className="min-w-28"
              />
              <Input
                hiddenLabel
                title="Value"
                name={`value-${row.id}`}
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                placeholder="value"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-foreground/40 hover:text-danger transition-colors"
                aria-label="Remove filter"
              >
                <XIcon size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        theme="ghost-muted"
        size="small"
        onClick={addRow}
        className="self-start"
      >
        <PlusIcon size={14} />
        Add condition
      </Button>
    </div>
  );
}
