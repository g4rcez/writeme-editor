import { Tag, Tooltip } from "@g4rcez/components";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  PropsWithChildren,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dates } from "../../lib/dates";
import { getReadingTime } from "../../lib/file-utils";
import { globalDispatch, useGlobalStore } from "../../store/global.store";
import { Editor } from "../editor";

const Wrapper = (props: PropsWithChildren) => {
  const ref = useRef(null);
  const [state, setState] = useState<React.ReactNode[] | null>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open) return;
    const div = ref.current;
    if (div === null) return;
    const fn = () => {
      const array = Array.from(
        document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6"),
      );
      if (array.length === 0) return setState(null);
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
      setState(items);
    };
    const observer = new MutationObserver(fn);
    fn();
    observer.observe(div, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  return (
    <div ref={ref} className="flex flex-col gap-4 w-full h-full">
      <header className="fixed left-4 py-2 top-navbar text-disabled">
        {state ? (
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
              <AnimatePresence>{open ? state : false}</AnimatePresence>
            </motion.ul>
          </Tooltip>
        ) : null}
      </header>
      {props.children}
    </div>
  );
};

export default function NotePage() {
  const [state] = useGlobalStore();
  const params = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const loadedNote = useDeferredValue(
    state.note?.id === params.noteId ? state.note : null,
  );
  const isLoading = state.note === null || loadedNote === null;

  useEffect(() => {
    globalDispatch.selectNoteById(params.noteId);
  }, [params.noteId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">Loading...</div>
    );
  }

  return (
    <Wrapper>
      {loadedNote.noteType === "read-it-later" ? (
        <header className="flex flex-col gap-2 py-4 mx-auto w-full border-b max-w-safe border-card-border">
          <h1 className="text-xl font-medium">{loadedNote.title}</h1>
          {loadedNote.url ? (
            <a
              target="_blank"
              className="link"
              href={loadedNote.url}
              rel="noopener noreferrer nofollow"
            >
              {new URL(loadedNote.url).hostname}
            </a>
          ) : null}
          <span className="flex gap-2 items-center text-sm">
            <Tag size="small">Read it later</Tag>-
            <time dateTime={loadedNote.createdAt.toISOString()}>
              {Dates.yearMonthDay(loadedNote.createdAt)}
            </time>
            -<i>{getReadingTime(loadedNote.content).formatted}</i>
          </span>
        </header>
      ) : null}
      <Editor
        note={loadedNote}
        key={loadedNote.id}
        content={loadedNote.content || ""}
      />
    </Wrapper>
  );
}
