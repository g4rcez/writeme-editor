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
    async function request() {
      setLoading(true);
      const quickNote = state.notes.find((x) => x.noteType === "quick");
      if (quickNote) {
        dispatch.note(quickNote);
      } else {
        const title = Dates.yearMonthDay(startOfDay(new Date()));
        const note = Note.new(`${title}-QuickNote`, "", "quick");
        await repositories.notes.save(note);
        dispatch.note(note, false);
      }
      setLoading(false);
    }
    request();
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
      <h1 className="py-2 mb-4 text-lg font-semibold border-b border-card-border">
        {state.note.title}
      </h1>
      <Editor content={state.note.content} note={state.note} />
    </div>
  );
}
