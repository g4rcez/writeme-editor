import { Checkbox, Dropdown } from "@g4rcez/components";
import { ColumnsIcon } from "@phosphor-icons/react/dist/csr/Columns";
import type { ViewColumn } from "@/store/repositories/entities/view";

const NOTE_COLUMNS: ViewColumn[] = [
  { field: "title", label: "Title" },
  { field: "noteType", label: "Type" },
  { field: "tags", label: "Tags" },
  { field: "favorite", label: "Favorite" },
  { field: "createdAt", label: "Created At" },
  { field: "updatedAt", label: "Updated At" },
  { field: "description", label: "Description" },
  { field: "url", label: "URL" },
  { field: "fileSize", label: "File Size" },
  { field: "content", label: "Content" },
];

const ENTITY_FIELDS: Record<string, ViewColumn[]> = {
  notes: [
    { field: "notes.title", label: "notes.title" },
    { field: "notes.noteType", label: "notes.noteType" },
    { field: "notes.tags", label: "notes.tags" },
    { field: "notes.favorite", label: "notes.favorite" },
    { field: "notes.createdAt", label: "notes.createdAt" },
    { field: "notes.updatedAt", label: "notes.updatedAt" },
    { field: "notes.content", label: "notes.content" },
    { field: "notes.description", label: "notes.description" },
    { field: "notes.url", label: "notes.url" },
    { field: "notes.id", label: "notes.id" },
    { field: "notes.project", label: "notes.project" },
  ],
  hashtags: [
    { field: "hashtags.id", label: "hashtags.id" },
    { field: "hashtags.hashtag", label: "hashtags.hashtag" },
    { field: "hashtags.filename", label: "hashtags.filename" },
    { field: "hashtags.project", label: "hashtags.project" },
    { field: "hashtags.createdAt", label: "hashtags.createdAt" },
    { field: "hashtags.updatedAt", label: "hashtags.updatedAt" },
  ],
  projects: [
    { field: "projects.id", label: "projects.id" },
    { field: "projects.name", label: "projects.name" },
    { field: "projects.createdAt", label: "projects.createdAt" },
    { field: "projects.updatedAt", label: "projects.updatedAt" },
  ],
  tabs: [
    { field: "tabs.id", label: "tabs.id" },
    { field: "tabs.noteId", label: "tabs.noteId" },
    { field: "tabs.order", label: "tabs.order" },
    { field: "tabs.project", label: "tabs.project" },
    { field: "tabs.createdAt", label: "tabs.createdAt" },
    { field: "tabs.updatedAt", label: "tabs.updatedAt" },
  ],
  noteGroups: [
    { field: "noteGroups.id", label: "noteGroups.id" },
    { field: "noteGroups.title", label: "noteGroups.title" },
    { field: "noteGroups.description", label: "noteGroups.description" },
    { field: "noteGroups.createdAt", label: "noteGroups.createdAt" },
    { field: "noteGroups.updatedAt", label: "noteGroups.updatedAt" },
  ],
  noteGroupMembers: [
    { field: "noteGroupMembers.id", label: "noteGroupMembers.id" },
    { field: "noteGroupMembers.groupId", label: "noteGroupMembers.groupId" },
    { field: "noteGroupMembers.noteId", label: "noteGroupMembers.noteId" },
    { field: "noteGroupMembers.order", label: "noteGroupMembers.order" },
    {
      field: "noteGroupMembers.createdAt",
      label: "noteGroupMembers.createdAt",
    },
    {
      field: "noteGroupMembers.updatedAt",
      label: "noteGroupMembers.updatedAt",
    },
  ],
  settings: [
    { field: "settings.id", label: "settings.id" },
    { field: "settings.name", label: "settings.name" },
    { field: "settings.value", label: "settings.value" },
    { field: "settings.createdAt", label: "settings.createdAt" },
    { field: "settings.updatedAt", label: "settings.updatedAt" },
  ],
  scripts: [
    { field: "scripts.id", label: "scripts.id" },
    { field: "scripts.name", label: "scripts.name" },
    { field: "scripts.content", label: "scripts.content" },
    { field: "scripts.createdAt", label: "scripts.createdAt" },
    { field: "scripts.updatedAt", label: "scripts.updatedAt" },
  ],
  views: [
    { field: "views.id", label: "views.id" },
    { field: "views.title", label: "views.title" },
    { field: "views.query", label: "views.query" },
    { field: "views.viewType", label: "views.viewType" },
    { field: "views.createdAt", label: "views.createdAt" },
    { field: "views.updatedAt", label: "views.updatedAt" },
  ],
};

type ColumnPickerProps = {
  columns: ViewColumn[];
  onChange: (columns: ViewColumn[]) => void;
  metadataKeys?: string[];
  joinedTables?: string[];
};

export function ColumnPicker({
  columns,
  onChange,
  metadataKeys = [],
  joinedTables = [],
}: ColumnPickerProps) {
  const allCols: ViewColumn[] =
    joinedTables.length > 1
      ? joinedTables.flatMap((t) => ENTITY_FIELDS[t] ?? [])
      : [
          ...NOTE_COLUMNS,
          ...metadataKeys.map((k) => ({
            field: `metadata.${k}`,
            label: `metadata.${k}`,
          })),
        ];

  const isEnabled = (field: string) => columns.some((c) => c.field === field);

  const toggle = (col: ViewColumn) => {
    if (isEnabled(col.field)) {
      onChange(columns.filter((c) => c.field !== col.field));
    } else {
      onChange([...columns, col]);
    }
  };

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-foreground/70 hover:bg-card-hover transition-colors"
        >
          <ColumnsIcon size={14} />
          Columns
        </button>
      }
    >
      <div className="flex flex-col gap-1 p-2 min-w-40 max-h-64 overflow-y-auto">
        {allCols.map((col) => (
          <label
            key={col.field}
            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/30 text-sm"
          >
            <Checkbox
              checked={isEnabled(col.field)}
              onChange={() => toggle(col)}
            />
            <span className="truncate">{col.label}</span>
          </label>
        ))}
      </div>
    </Dropdown>
  );
}
