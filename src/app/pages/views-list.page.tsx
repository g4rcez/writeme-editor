import { Button } from "@g4rcez/components";
import { DatabaseIcon } from "@phosphor-icons/react/dist/csr/Database";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { TableIcon } from "@phosphor-icons/react/dist/csr/Table";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositories } from "@/store/repositories";
import { View } from "@/store/repositories/entities/view";

export default function ViewsListPage() {
  const navigate = useNavigate();
  const [views, setViews] = useState<View[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const all = await repositories.views.getAll();
    setViews(all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const now = new Date();
    const view = new View(
      crypto.randomUUID(),
      "Untitled View",
      "",
      [{ field: "title", label: "Title" }],
      "table",
      null,
      "ASC",
      {},
      now,
      now,
    );
    await repositories.views.save(view);
    navigate(`/views/${view.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this view?")) return;
    await repositories.views.delete(id);
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
      <div className="flex justify-between items-center mb-6">
        <h1 className="flex gap-2 items-center text-2xl font-bold">
          <DatabaseIcon className="w-6 h-6" />
          Views
        </h1>
        <Button size="small" theme="primary" onClick={handleCreate}>
          <PlusIcon className="w-4 h-4" />
          New View
        </Button>
      </div>

      {!loading && views.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-foreground/50">
          <DatabaseIcon className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm mb-4">
            No views yet. Create one to query your notes.
          </p>
          <Button size="small" theme="primary" onClick={handleCreate}>
            <PlusIcon className="w-4 h-4" />
            New View
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {views.map((view) => (
          <div
            key={view.id}
            onClick={() => navigate(`/views/${view.id}`)}
            className="group relative flex flex-col gap-1 p-4 rounded-lg border border-border bg-card cursor-pointer transition-colors hover:border-primary/50 hover:bg-card/80"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold truncate">{view.title}</h2>
              <button
                onClick={(e) => handleDelete(e, view.id)}
                className="shrink-0 p-1.5 rounded text-foreground/40 opacity-0 group-hover:opacity-100 transition-all hover:text-danger hover:bg-danger/10"
                title="Delete view"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            {view.query ? (
              <p className="text-xs font-mono text-foreground/50 line-clamp-2 bg-card-background rounded px-2 py-1 mt-1">
                {view.query}
              </p>
            ) : (
              <p className="text-xs text-foreground/40 italic mt-1">No query</p>
            )}
            <div className="mt-2 flex items-center gap-1 text-xs text-foreground/40">
              <TableIcon size={12} />
              <span className="capitalize">{view.viewType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
