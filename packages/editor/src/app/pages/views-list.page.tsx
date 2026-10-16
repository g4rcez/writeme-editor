import { Button } from "@g4rcez/components";
import { DatabaseIcon } from "@phosphor-icons/react/dist/csr/Database";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TableIcon } from "@phosphor-icons/react/dist/csr/Table";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMissingStarterViews } from "@/lib/starter-views";
import { repositories } from "@/store/repositories";
import { View } from "@/store/repositories/entities/view";

export default function ViewsListPage() {
    const navigate = useNavigate();
    const [views, setViews] = useState<View[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const missingStarters = getMissingStarterViews(views, new Date());

    const load = useCallback(
        () =>
            repositories.views
                .getAll()
                .then((all) => {
                    setViews(all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
                })
                .catch(() => {
                    setError("Could not load Views. Check storage and try again.");
                })
                .finally(() => {
                    setLoading(false);
                }),
        [],
    );

    useEffect(() => {
        void load();
    }, [load]);

    const handleAddStarters = async (): Promise<void> => {
        if (creating) return;
        setCreating(true);
        setError(null);
        try {
            const existing = await repositories.views.getAll();
            for (const view of getMissingStarterViews(existing, new Date())) await repositories.views.save(view);
            await load();
        } catch {
            setError("Could not add starter Views. Try again to add any missing Views.");
        } finally {
            setCreating(false);
        }
    };

    const handleCreate = async () => {
        if (creating) return;
        setCreating(true);
        setError(null);
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
        try {
            await repositories.views.save(view);
            navigate(`/views/${view.id}`);
        } catch {
            setError("Could not create a View. Check storage and try again.");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Delete this view?")) return;
        try {
            await repositories.views.delete(id);
            setViews((prev) => prev.filter((v) => v.id !== id));
        } catch {
            setError("Could not delete this View. Check storage and try again.");
        }
    };

    return (
        <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <h1 className="flex gap-2 items-center text-2xl font-bold">
                    <DatabaseIcon className="w-6 h-6" aria-hidden="true" />
                    Views
                </h1>
                <Button size="small" theme="primary" disabled={loading || creating} onClick={handleCreate}>
                    <PlusIcon className="w-4 h-4" aria-hidden="true" />
                    New View
                </Button>
            </div>

            {!loading && missingStarters.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Start with your 20 most recently edited notes and a queue of Read it later notes.
                    </p>
                    <Button size="small" theme="muted" disabled={creating} onClick={() => void handleAddStarters()}>
                        {creating ? "Adding…" : "Add starter Views"}
                    </Button>
                </div>
            )}

            {error && (
                <div
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                    role="alert"
                >
                    <p className="text-sm text-foreground">{error}</p>
                    <Button
                        size="small"
                        theme="muted"
                        onClick={() => {
                            setLoading(true);
                            setError(null);
                            void load();
                        }}
                    >
                        Retry
                    </Button>
                </div>
            )}

            {loading && (
                <output className="block py-12 text-center text-sm text-muted-foreground">Loading Views…</output>
            )}
            {!loading && !error && views.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-foreground/50">
                    <DatabaseIcon className="w-12 h-12 mb-3 opacity-40" aria-hidden="true" />
                    <p className="text-sm mb-4">No Views yet. Create one to query your notes.</p>
                    <Button size="small" theme="primary" disabled={creating} onClick={handleCreate}>
                        <PlusIcon className="w-4 h-4" aria-hidden="true" />
                        New View
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {views.map((view) => (
                    <article
                        key={view.id}
                        className="group relative flex flex-col gap-1 p-4 rounded-lg border border-border bg-card transition-colors hover:border-primary/50 hover:bg-card/80"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => navigate(`/views/${view.id}`)}
                                className="min-w-0 truncate text-left font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {view.title}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => void handleDelete(e, view.id)}
                                className="shrink-0 rounded p-1.5 text-foreground/50 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Delete ${view.title}`}
                            >
                                <TrashIcon className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                        {view.query ? (
                            <p className="text-xs font-mono text-foreground/50 line-clamp-2 bg-card-background rounded px-2 py-1 mt-1">
                                {view.query}
                            </p>
                        ) : (
                            <p className="text-xs text-foreground/40 italic mt-1">No query</p>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-xs text-foreground/50">
                            <TableIcon size={12} aria-hidden="true" />
                            <span className="capitalize">{view.viewType}</span>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}
