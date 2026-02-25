import { Button, css, Tooltip } from "@g4rcez/components";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
  element?: HTMLHeadingElement;
}

export const TableOfContents = () => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const updateHeadings = () => {
      const elements = Array.from(
        document.querySelectorAll<HTMLHeadingElement>(
          ".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6",
        ),
      );
      const container =
        document.getElementById("main-scroll-container") || document.body;
      const targetElements =
        elements.length > 0
          ? elements
          : Array.from(
              container.querySelectorAll<HTMLHeadingElement>(
                "h1, h2, h3, h4, h5, h6",
              ),
            );

      const newHeadings = targetElements.map((element, index) => ({
        element,
        text: element.innerText,
        level: Number(element.tagName.replace("H", "")),
        id: element.id || element.getAttribute("data-id") || `heading-${index}`,
      }));

      setHeadings(newHeadings);
    };
    updateHeadings();
    const observer = new MutationObserver(updateHeadings);
    const editorElement =
      document.querySelector(".ProseMirror") || document.body;
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["id", "data-id"],
    });
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <div className="fixed right-6 top-24 z-50 print:hidden">
      <Tooltip
        placement="bottom-end"
        className="p-0 bg-transparent border-none shadow-none"
        title={
          <span
            className={css(
              "flex items-center justify-center p-2 rounded-xl transition-all duration-300",
              "bg-background/80 backdrop-blur-md border border-border shadow-sm",
              "hover:bg-muted/50 hover:border-primary/20",
              isOpen ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            <ListBulletsIcon size={20} />
          </span>
        }
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={css(
            "flex flex-col gap-3 p-4 pr-2 mt-2 rounded-xl",
            "min-w-48 max-w-64 max-h-96",
          )}
        >
          <div className="flex justify-between items-center pb-2 mb-1 border-b border-border/50">
            <span className="text-sm font-medium tracking-wider text-muted-foreground/80">
              Table of Contents
            </span>
            <button
              className="p-1 rounded-full transition-colors text-muted-foreground hover:bg-muted/50"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            >
              <XIcon size={14} />
            </button>
          </div>
          <ul className="flex overflow-y-auto overscroll-contain flex-col gap-1 pr-2 custom-scrollbar">
            <AnimatePresence>
              {headings.map((heading) => (
                <motion.li
                  key={heading.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ paddingLeft: `${(heading.level - 1) * 0.8}rem` }}
                  className="relative group"
                >
                  <a
                    href={`#${heading.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el =
                        document.getElementById(heading.id) ||
                        document.querySelector(`[data-id="${heading.id}"]`) ||
                        (heading.element && heading.element.isConnected
                          ? heading.element
                          : null);

                      if (el) {
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }}
                    className={css(
                      "block py-1 text-sm transition-all duration-200 line-clamp-2",
                      "text-muted-foreground hover:text-primary hover:font-medium",
                      "border-l-2 border-transparent hover:border-primary pl-3 -ml-3",
                    )}
                  >
                    {heading.text}
                  </a>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.div>
      </Tooltip>
    </div>
  );
};
