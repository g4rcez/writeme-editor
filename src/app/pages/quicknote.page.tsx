import { useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";

export default function QuickNotePage() {
  const [state] = useGlobalStore();
  if (!state.note) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        Loading Quick Note...
      </div>
    );
  }
  return (
    <div className="w-full h-full">
      <h1 className="font-semibold">{state.note.title}</h1>
      <Editor content={state.note.content} note={state.note} />
    </div>
  );
}
