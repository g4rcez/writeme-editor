import { useEffect } from "react";
import { Editor } from "@/app/editor";
import { useGlobalStore } from "@/store/global.store";

export default function FloatingEditorPage() {
    const [state] = useGlobalStore((state) => ({ commander: state.commander, note: state.note }));
    const note = state.note;
    const commander = state.commander;
    useEffect(() => {
        if (commander.enabled) return;
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") window.close();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [commander.enabled]);

    return (
        <div className="flex h-full min-h-0 w-full overflow-y-auto overscroll-contain bg-background px-6 pt-12">
            <Editor note={note ?? undefined} content={note?.content ?? ""} key={note?.id ?? "floating-editor"} />
        </div>
    );
}
