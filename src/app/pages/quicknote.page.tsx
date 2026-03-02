import { startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { Dates } from "@/lib/dates";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { Editor } from "@/app/editor";

export default function QuickNotePage() {
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useGlobalStore();

  useEffect(() => {
    let ignored = false;
    async function request() {
      setLoading(true);
      const existing = await repositories.notes.getQuicknoteByDate(startOfDay(new Date()));
      if (ignored) return;
      if (existing) {
        dispatch.note(existing);
      } else {
        const title = Dates.yearMonthDay(startOfDay(new Date()));
        const note = Note.new(`${title}-QuickNote`, "", "quick");
        await repositories.notes.save(note);
        dispatch.note(note, false);
      }
      setLoading(false);
    }
    request();
    return () => { ignored = true; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading || !state.note) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        Loading Quick Note...
      </div>
    );
  }
  return (
    <div className="mx-auto w-full h-full print:block print:h-auto print:overflow-visible max-w-safe">
      <div className="flex justify-between items-center py-2 mb-4 border-b border-card-border">
        <h1 className="text-lg font-semibold">{state.note.title}</h1>
        <span className="text-xs text-disabled">Press Esc to close</span>
      </div>
      <Editor content={state.note.content} note={state.note} />
    </div>
  );
}
