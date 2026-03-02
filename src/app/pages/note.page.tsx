import { Dates } from "@/lib/dates";
import { getReadingTime } from "@/lib/file-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { Tag } from "@g4rcez/components";
import { type PropsWithChildren, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { TableOfContents } from "../components/table-of-contents";
import { Editor } from "../editor";
import { JsonGraph } from "../elements/json-graph/json-graph";

const Wrapper = (props: PropsWithChildren) => {
  return (
    <div className="flex relative flex-col gap-4 py-6 px-8 w-full h-full print:block print:h-auto print:overflow-visible">
      <TableOfContents />
      {props.children}
    </div>
  );
};

export default function NotePage() {
  const [uiState] = useUIStore();
  const [state, dispatch] = useGlobalStore();
  const params = useParams<{ noteId: string }>();
  const id = params.noteId;
  const note = state.note;
  const isLoading = note === null;

  useEffect(() => {
    if (id === state.note?.id) return;
    repositories.notes.getOne(id!).then((x) => {
      const n = x || null;
      dispatch.setNote(n);
    });
    const hasTab = state.tabs.some((x) => x.noteId === id);
    if (!hasTab) dispatch.addTab(id!);
  }, [id, state.tabs.length, state.note?.id]);

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

  const isJson = note.noteType === ("json" as any);

  return (
    <Wrapper>
      {note.noteType === "read-it-later" ? (
        <header className="flex flex-col gap-2 py-4 mx-auto w-full border-b bg-background max-w-safe border-card-border">
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

      {isJson ? (
        <div className="flex-1 h-[calc(100vh-160px)]">
          <JsonGraph
            json={(() => {
              try {
                return JSON.parse(note.content);
              } catch {
                return { error: "Failed to parse JSON", raw: note.content };
              }
            })()}
            onChange={(newJson) => {
              const content = JSON.stringify(newJson, null, 2);
              repositories.notes.updateContent(note.id, content);
              dispatch.updateNoteContent(note.id, content);
            }}
          />
        </div>
      ) : (
        <Editor note={note} key={note.id} content={note.content || ""} />
      )}
    </Wrapper>
  );
}
