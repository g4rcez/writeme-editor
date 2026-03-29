import { Input } from "@g4rcez/components";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { FunnelIcon } from "@phosphor-icons/react/dist/csr/Funnel";
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { parse } from "@/lib/views/parser";
import { repositories } from "@/store/repositories";
import { View, type ViewColumn } from "@/store/repositories/entities/view";
import { useViewQuery } from "@/app/hooks/use-view-query";
import { QueryEditor } from "@/app/components/views/query-editor";
import { FilterBuilder } from "@/app/components/views/filter-builder";
import { ViewTable } from "@/app/components/views/view-table";
import { ColumnPicker } from "@/app/components/views/column-picker";
import {
  astToFilterGroup,
  filterGroupToQueryString,
  type FilterGroup,
} from "@/lib/views/query-builder";
import { useGlobalStore } from "@/store/global.store";

type Tab = "sql" | "filters";

export default function ViewDetailPage() {
  const { viewId } = useParams<{ viewId: string }>();
  const navigate = useNavigate();
  const [state] = useGlobalStore();

  const [view, setView] = useState<View | null>(null);
  const [title, setTitle] = useState("Untitled View");
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [columns, setColumns] = useState<ViewColumn[]>([
    { field: "title", label: "Title" },
  ]);
  const [activeTab, setActiveTab] = useState<Tab>("sql");
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: crypto.randomUUID(),
    logic: "AND",
    filters: [],
  });
  const [isFilterComplex, setIsFilterComplex] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { results, error, timing, query: parsedQuery } = useViewQuery(query);

  const joinedTables = useMemo(() => {
    try {
      if (!parsedQuery) return [];
      const tables: string[] = [];
      if (parsedQuery.from) tables.push(parsedQuery.from);
      for (const j of parsedQuery.joins) tables.push(j.table);
      return tables.length > 1 ? tables : [];
    } catch {
      return [];
    }
  }, [parsedQuery]);

  // Derive display columns from the SELECT clause or result row keys
  const displayColumns = useMemo<ViewColumn[]>(() => {
    // SELECT with explicit columns → use them (with alias as label)
    if (parsedQuery?.select && parsedQuery.select.columns.length > 0) {
      return parsedQuery.select.columns.map((item) => {
        if (item.type === "Column") {
          const field = item.path.join(".");
          return { field, label: item.alias ?? field };
        }
        const colStr = item.column ? item.column.path.join(".") : "*";
        const field = `${item.fn}(${colStr})`;
        return { field, label: item.alias ?? field };
      });
    }
    // No SELECT or SELECT * → derive all columns from first result row
    if (results.length > 0) {
      return Object.keys(results[0]!).map((key) => ({
        field: key,
        label: key,
      }));
    }
    return columns;
  }, [parsedQuery, results, columns]);

  // Load view on mount
  useEffect(() => {
    if (!viewId) return;
    repositories.views.getOne(viewId).then((v) => {
      if (!v) return;
      setView(v);
      setTitle(v.title);
      setQuery(v.query);
      setColumns(
        v.columns.length > 0 ? v.columns : [{ field: "title", label: "Title" }],
      );
    });
  }, [viewId]);

  // Sync filter group from query when switching to filters tab
  useEffect(() => {
    if (activeTab !== "filters") return;
    try {
      const parsed = parse(query);
      const group = astToFilterGroup(parsed.where, filterGroup.id);
      if (group) {
        setFilterGroup(group);
        setIsFilterComplex(false);
      } else {
        setIsFilterComplex(true);
      }
    } catch {
      setIsFilterComplex(true);
    }
  }, [activeTab]);

  // Auto-save on changes
  const scheduleSave = useCallback(
    (patch: Partial<View>) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!view) return;
        const updated = { ...view, ...patch, updatedAt: new Date() };
        await repositories.views.update(view.id, updated);
        setView(updated as View);
      }, 600);
    },
    [view],
  );

  const handleTitleSave = () => {
    if (editingTitle === null) return;
    const trimmed = editingTitle.trim() || "Untitled View";
    setTitle(trimmed);
    setEditingTitle(null);
    scheduleSave({ title: trimmed });
  };

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    scheduleSave({ query: newQuery });
  };

  const handleColumnsChange = (newColumns: ViewColumn[]) => {
    setColumns(newColumns);
    scheduleSave({ columns: newColumns });
  };

  const handleFilterGroupChange = (group: FilterGroup) => {
    setFilterGroup(group);
    const newQuery = filterGroupToQueryString(group);
    setQuery(newQuery);
    scheduleSave({ query: newQuery });
  };

  // Collect metadata keys from all notes
  const metadataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const note of state.notes) {
      if (note.metadata) {
        for (const k of Object.keys(note.metadata)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [state.notes]);

  if (!view) {
    return (
      <div className="flex items-center justify-center min-h-full text-foreground/40 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
      {/* Back button */}
      <button
        onClick={() => navigate("/views")}
        className="flex items-center gap-1.5 mb-4 text-sm text-foreground/60 hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        All Views
      </button>

      {/* Title */}
      <div className="mb-6">
        {editingTitle !== null ? (
          <Input
            hiddenLabel
            title="View title"
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") setEditingTitle(null);
            }}
          />
        ) : (
          <h1
            className="text-2xl font-bold cursor-text hover:underline decoration-dashed"
            onClick={() => setEditingTitle(title)}
            title="Click to edit"
          >
            {title}
          </h1>
        )}
      </div>

      {/* Query area */}
      <div>
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-border">
          <button
            onClick={() => setActiveTab("sql")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 ${
              activeTab === "sql"
                ? "border-primary text-primary"
                : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            <CodeIcon size={13} />
            SQL Query
          </button>
          <button
            onClick={() => setActiveTab("filters")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 ${
              activeTab === "filters"
                ? "border-primary text-primary"
                : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            <FunnelIcon size={13} />
            Visual Filters
          </button>
          <div className="ml-auto pb-1">
            <ColumnPicker
              columns={columns}
              onChange={handleColumnsChange}
              metadataKeys={metadataKeys}
              joinedTables={joinedTables}
            />
          </div>
        </div>

        {/* Tab content */}
        <div className="py-4">
          {activeTab === "sql" ? (
            <QueryEditor
              value={query}
              onChange={handleQueryChange}
              error={error}
              resultCount={error ? null : results.length}
              timing={timing}
            />
          ) : isFilterComplex ? (
            <div className="text-sm text-foreground/50 py-2">
              Complex query — switch to the SQL Query tab to edit it directly.
            </div>
          ) : (
            <FilterBuilder
              group={filterGroup}
              onChange={handleFilterGroupChange}
            />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mt-2">
        <ViewTable rows={results} columns={displayColumns} />
      </div>
    </div>
  );
}
