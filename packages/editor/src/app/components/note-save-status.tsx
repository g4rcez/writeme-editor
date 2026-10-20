import { CircleNotchIcon } from "@phosphor-icons/react";
import { useUIStore } from "@/store/ui.store";

export function NoteSaveStatus({ noteId }: { noteId: string }) {
    const [status] = useUIStore((state) => state.noteSaveStatuses[noteId] ?? "saved");
    const label =
        status === "saving"
            ? "Saving…"
            : status === "unsaved"
              ? "Unsaved changes"
              : status === "error"
                ? "Save failed"
                : "Saved";
    return (
        <output
            aria-label="Note save status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-muted-foreground print:hidden"
        >
            {status === "saving" ? (
                <CircleNotchIcon aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
            ) : (
                <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${status === "error" ? "bg-danger" : status === "unsaved" ? "bg-warn" : "bg-success"}`}
                />
            )}
            {label}
        </output>
    );
}
