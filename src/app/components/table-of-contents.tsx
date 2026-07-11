import { css } from "@g4rcez/components";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type Heading = {
    id: string;
    text: string;
    level: number;
    element?: HTMLHeadingElement;
};

export const TableOfContents = () => {
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const popoverId = useId();
    const popoverRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const updateHeadings = () => {
            const elements = Array.from(
                document.querySelectorAll<HTMLHeadingElement>(
                    ".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6",
                ),
            );
            const container = document.getElementById("main-scroll-container") || document.body;
            const targetElements =
                elements.length > 0
                    ? elements
                    : Array.from(container.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5, h6"));

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
        const editorElement = document.getElementById("main-scroll-container") || document.body;
        observer.observe(editorElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
            attributeFilter: ["id", "data-id"],
        });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && popoverRef.current?.contains(target)) {
                return;
            }
            setIsOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    if (headings.length === 0) return null;

    return (
        <div ref={popoverRef} className="fixed right-5 top-20 z-50 print:hidden">
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? popoverId : undefined}
                aria-label="Open table of contents"
                onClick={() => setIsOpen((open) => !open)}
                className={css(
                    "flex size-11 items-center justify-center rounded-button-radius border transition-[background-color,border-color,color,transform] duration-200",
                    "border-card-border bg-card-background text-muted-foreground shadow-soft",
                    "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isOpen && "border-primary/35 bg-primary/10 text-primary",
                )}
            >
                <ListBulletsIcon size={21} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id={popoverId}
                        role="dialog"
                        aria-label="Table of contents"
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -8 }}
                        initial={{ opacity: 0, scale: 0.96, y: -8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className={css(
                            "absolute right-0 top-full mt-3 flex max-h-96 w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card-radius",
                            "border border-floating-border bg-floating-background text-floating-foreground shadow-medium",
                        )}
                    >
                        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                            <div>
                                <span className="block text-sm font-semibold text-foreground">Contents</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {headings.length} section{headings.length === 1 ? "" : "s"}
                                </span>
                            </div>
                            <button
                                type="button"
                                aria-label="Close table of contents"
                                className="flex size-8 items-center justify-center rounded-button-radius text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => setIsOpen(false)}
                            >
                                <XIcon size={15} />
                            </button>
                        </div>
                        <ul className="flex overflow-y-auto overscroll-contain flex-col gap-1 p-2 custom-scrollbar">
                            {headings.map((heading) => (
                                <motion.li
                                    key={heading.id}
                                    className="relative"
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.18 }}
                                    initial={{ opacity: 0, x: -4 }}
                                    style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}
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
                                                setIsOpen(false);
                                            }
                                        }}
                                        className={css(
                                            "group flex min-h-9 items-center gap-2 rounded-button-radius px-2.5 py-2 text-left text-sm transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                                            heading.level <= 2 && "font-medium text-foreground/85",
                                        )}
                                    >
                                        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/35 transition-colors group-hover:bg-primary" />
                                        <span className="line-clamp-2 min-w-0">{heading.text}</span>
                                    </a>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
