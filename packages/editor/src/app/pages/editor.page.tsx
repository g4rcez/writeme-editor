import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalStore } from "../../store/global.store";
import DashboardPage from "./dashboard.page";

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
