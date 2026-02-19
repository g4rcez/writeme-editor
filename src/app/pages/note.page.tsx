import { Note } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import { Tag, Tooltip } from "@g4rcez/components";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  PropsWithChildren,
  useEffect,
  useRef,
  useState
} from "react";
import { Link, useParams } from "react-router-dom";
import { Dates } from "../../lib/dates";
import { getReadingTime } from "../../lib/file-utils";
import { repositories } from "../../store/global.store";
import { Editor } from "../editor";

const Wrapper = (props: PropsWithChildren) => {
  const ref = useRef(null);
  const [tableOfContents, setTableOfContents] = useState<
    React.ReactNode[] | null
  >(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open) return;
    const div = ref.current;
    if (div === null) return;
    const fn = () => {
      const array = Array.from(
        document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6"),
      );
      if (array.length === 0) return setTableOfContents(null);
      const items = array.map((h, index) => {
        const level = Number(h.tagName.replace(/[^0-9]/g, ""));
        return (
          <motion.li
            key={`heading-${h.innerText}-${index}`}
            className="font-medium"
          >
            <a
              href={`#${h.id}`}
              style={{ marginLeft: level === 1 ? 0 : `${level * 1}rem` }}
              className="transition-colors duration-300 ease-linear cursor-pointer hover:underline text-primary hover:text-primary-hover"
            >
              {h.innerText}
            </a>
          </motion.li>
        );
      });
      setTableOfContents(items);
    };
    const observer = new MutationObserver(fn);
    fn();
    observer.observe(div, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  return (
    <div ref={ref} className="flex flex-col gap-4 w-full h-full">
      <header className="fixed left-4 py-2 top-navbar text-disabled">
        {tableOfContents ? (
          <Tooltip
            onChange={setOpen}
            placement="bottom-end"
            title={
              <span className="flex gap-1 items-center">
                <ChevronDownIcon size={12} />
                Table of contents
                <ChevronDownIcon size={12} />
              </span>
            }
          >
            <motion.ul
              animate={open.toString()}
              className="overflow-y-auto overscroll-contain max-h-72"
              variants={{ true: { opacity: 1 }, false: { opacity: 0 } }}
            >
              <AnimatePresence>
                {open ? tableOfContents : false}
              </AnimatePresence>
            </motion.ul>
          </Tooltip>
        ) : null}
      </header>
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
    repositories.notes.getOne(id).then((x) => {
      if (x) setNote(x);
      else setNote(null);
    });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">Loading...</div>
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
        <header className="flex flex-col gap-2 py-4 mx-auto w-full border-b max-w-safe border-card-border">
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
