import { useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";
import { ExcalidrawCode } from "../elements/excalidraw";

export default function EditorPage() {
  const [state] = useGlobalStore();
  return (
    <div className="flex flex-col gap-8 w-full">
      <ExcalidrawCode code={"[]"} />
      <Editor
        key={state.note.id}
        content={state?.note.content}
        note={state.note}
      />
    </div>
  );
}
