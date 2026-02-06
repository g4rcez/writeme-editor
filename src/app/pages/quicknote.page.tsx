import { useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";

const QuickNotePage = () => {
  const [state] = useGlobalStore();

  if (!state.note) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading Quick Note...
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor content={state.note.content} note={state.note} />
    </div>
  );
};

export default QuickNotePage;
