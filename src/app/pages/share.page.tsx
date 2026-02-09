import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { repositories } from "../../store/global.store";
import { Note } from "../../store/note";

export default function SharePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) {
      navigate("/");
      return;
    }

    try {
      const decoded = decodeURIComponent(encodeURIComponent(window.atob(q)));
      const title = "Shared Note";
      const note = Note.new(title, decoded);
      
      repositories.notes.save(note).then(() => {
          navigate(`/note/${note.id}`);
      });
    } catch (e) {
      console.error("Failed to decode shared note", e);
      navigate("/");
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex justify-center items-center h-full">
      <p>Importing shared note...</p>
    </div>
  );
}
