import { View } from "@/store/repositories/entities/view";

const STARTER_VIEWS = [
    {
        id: "starter-view-recently-edited",
        title: "Recently edited",
        query: "ORDER BY updatedAt DESC LIMIT 20",
    },
    {
        id: "starter-view-reading-queue",
        title: "Reading queue",
        query: "WHERE noteType = 'read-it-later' ORDER BY updatedAt DESC",
    },
] as const;

export function getMissingStarterViews(existing: readonly View[], now: Date): View[] {
    return STARTER_VIEWS.filter(
        (starter) =>
            !existing.some(
                (view) =>
                    view.id === starter.id ||
                    view.title.toLocaleLowerCase() === starter.title.toLocaleLowerCase() ||
                    view.query === starter.query,
            ),
    ).map(
        (starter) =>
            new View(
                starter.id,
                starter.title,
                starter.query,
                [{ field: "title", label: "Title" }],
                "table",
                "updatedAt",
                "DESC",
                {},
                now,
                now,
            ),
    );
}
