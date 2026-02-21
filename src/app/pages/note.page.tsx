import { Note } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import { Tag } from "@g4rcez/components";
import { PropsWithChildren, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Dates } from "@/lib/dates";
import { getReadingTime } from "@/lib/file-utils";
import { repositories } from "@/store/global.store";
import { Editor } from "../editor";
import { TableOfContents } from "../components/table-of-contents";

const Wrapper = (props: PropsWithChildren) => {
  return (
    <div className="flex px-8 py-6 relative flex-col gap-4 w-full">
      <TableOfContents />
      {props.children}
    </div>
  );
};

export default function NotePage() {
  const [uiState] = useUIStore();
  const [note, setNote] = useState<Note | null>(null);
  const params = useParams<{ noteId: string }>();
  const id = params.noteId;
  const isLoading = note === null;

  useEffect(() => {
    repositories.notes.getOne(id).then((x) => setNote(x || null));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        Fetching note...
      </div>
    );
  }

  if (uiState.error && note === null) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center p-8">
        <span className="text-lg font-medium capitalize">Note not found</span>
        <Link to="/">Go to dashboard</Link>
      </div>
    );
  }

  return (
    <Wrapper>
      {note.noteType === "read-it-later" ? (
        <header className="bg-card-background flex flex-col gap-2 py-4 mx-auto w-full border-b max-w-safe border-card-border">
          <h1 className="text-xl font-medium">{note.title}</h1>
          {note.url ? (
            <a
              target="_blank"
              className="link"
              href={note.url}
              rel="noopener noreferrer nofollow"
            >
              {new URL(note.url).hostname}
            </a>
          ) : null}
          <span className="flex gap-2 items-center text-sm">
            <Tag size="small">Read it later</Tag>-
            <time dateTime={note.createdAt.toISOString()}>
              {Dates.yearMonthDay(note.createdAt)}
            </time>
            -<i>{getReadingTime(note.content).formatted}</i>
          </span>
        </header>
      ) : null}
      <Editor note={note} key={note.id} content={note.content || ""} />
    </Wrapper>
  );
}
