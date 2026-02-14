import { useEffect } from "react";
import { useGlobalStore } from "../../store/global.store";
import { useNavigate } from "react-router-dom";
import { DashboardPage } from "./dashboard.page";

export default function EditorPage() {
  const [state] = useGlobalStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.note) {
      navigate(`/note/${state.note.id}`, { replace: true });
    }
  }, [state.note, navigate]);

  return <DashboardPage />;
}
