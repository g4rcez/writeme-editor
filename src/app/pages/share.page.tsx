import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { repositories } from "@/store/global.store";
import { Note } from "@/store/note";
import { base64ToUtf8 } from "@/lib/encoding";

export default function SharePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) {
      return void navigate("/");
    }
    try {
      const decoded = base64ToUtf8(q);
      repositories.notes.save(Note.new("Shared Note", decoded)).then((note) => {
        navigate(`/note/${note.id}`);
      });
    } catch (e) {
      console.error("Failed to decode/save shared note", e);
      setError(true);
    }
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-full">
        <p className="text-muted-foreground">Failed to import shared note.</p>
        <a href="/" className="hover:underline text-primary">
          Go home
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 justify-center items-center h-full">
      <p className="text-muted-foreground">Importing shared note…</p>
    </div>
  );
}
