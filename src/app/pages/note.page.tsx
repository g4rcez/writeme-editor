import { motion, AnimatePresence } from "motion/react";
import { negate, Tooltip } from "@g4rcez/components";
import { ChevronDownIcon } from "lucide-react";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
      setState(
        Array.from(
          document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6"),
        ).map((h, index) => {
          const level = Number(h.tagName.replace(/[^0-9]/g, ""));
          return (
            <motion.li
              key={`heading-${h.innerText}-${index}`}
              className="font-medium"
            >
              <a
                href={`#${h.id}`}
                style={{ marginLeft: level === 1 ? 0 : `${level * 1}rem` }}
                className="transition-colors duration-300 ease-linear cursor-pointer hover:underline text-secondary hover:text-primary-hover"
              >
                {h.innerText}
              </a>
            </motion.li>
          );
        }),
      );
    };
    const observer = new MutationObserver(fn);
    fn();
    observer.observe(div, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  return (
    <div ref={ref} className="flex flex-col gap-4 w-full h-full">
      <header className="fixed left-4 top-12 py-2 text-disabled">
        <Tooltip
          placement="bottom-end"
          onChange={setOpen}
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
            variants={{ true: { opacity: 1 }, false: { opacity: 0 } }}
          >
            <AnimatePresence>{open ? state : false}</AnimatePresence>
          </motion.ul>
        </Tooltip>
      </header>
      {props.children}
    </div>
  );
};

export default function NotePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [state] = useGlobalStore();
  const navigate = useNavigate();
  const isLoading = state.note === null;
  const loadedNote = state.note;

  useEffect(() => {
    globalDispatch.selectNoteById(noteId);
  }, [noteId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">Loading...</div>
    );
  }

  if (!loadedNote) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center p-8">
        <h2 className="text-xl">Note not found</h2>
        <p className="text-muted-foreground">
          The note you are looking for does not exist or has been deleted.
        </p>
        <button
          onClick={() => navigate("/")}
          className="py-2 px-4 rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <Wrapper>
      <Editor
        note={loadedNote}
        key={loadedNote.id}
        content={loadedNote.content || ""}
      />
    </Wrapper>
  );
}
