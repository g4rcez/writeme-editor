import { useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";

export default function EditorPage() {
  const [state] = useGlobalStore();
  return (
    <Editor
      key={state.note.id}
      content={state?.note.content}
      note={state.note}
    />
  );
}
