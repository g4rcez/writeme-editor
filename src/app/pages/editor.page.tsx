import { useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";

export default function EditorPage() {
  const [state] = useGlobalStore();
  return (
    <div className="flex flex-col gap-8 w-full">
      <Editor
        note={state.note}
        key={state.note.id}
        content={state?.note?.content || ""}
      />
    </div>
  );
}
