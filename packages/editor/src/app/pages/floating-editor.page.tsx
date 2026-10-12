import { NoteSaveStatus } from "@/app/components/note-save-status";
import { Editor } from "@/app/editor";
import { EscapeLevel, useEscapeLayer } from "@/app/hooks/use-escape-layer";
import { useGlobalStore } from "@/store/global.store";

export default function FloatingEditorPage() {
    const [state] = useGlobalStore((state) => ({ note: state.note }));
    const note = state.note;
    useEscapeLayer(EscapeLevel.window, true, () => window.close());

    return (
        <div className="relative flex h-full min-h-0 w-full overflow-y-auto overscroll-contain bg-background px-6 pt-12">
            {note && (
                <div className="absolute right-6 top-4">
                    <NoteSaveStatus noteId={note.id} />
                </div>
            )}
            <Editor note={note ?? undefined} content={note?.content ?? ""} key={note?.id ?? "floating-editor"} />
        </div>
    );
}
