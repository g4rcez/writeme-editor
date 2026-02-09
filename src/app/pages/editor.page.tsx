import { useEffect } from "react";
import { useGlobalStore } from "../../store/global.store";
import { useNavigate } from "react-router-dom";

export default function EditorPage() {
  const [state] = useGlobalStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.note) {
      navigate(`/note/${state.note.id}`, { replace: true });
    }
  }, [state.note, navigate]);

  return (
    <div className="flex justify-center items-center p-8 w-full h-full">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Welcome to Writeme</h2>
        <p className="text-muted-foreground">Select a note to start writing.</p>
      </div>
    </div>
  );
}