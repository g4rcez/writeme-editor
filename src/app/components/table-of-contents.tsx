import { css } from "@g4rcez/components";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type Heading = {
    id: string;
    text: string;
    level: number;
    element: HTMLHeadingElement;
};

export const TableOfContents = () => {
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const popoverId = useId();
    const popoverRef = useRef<HTMLDivElement>(null);
    const shouldReduceMotion = useReducedMotion();

    useLayoutEffect(() => {
        const container = document.getElementById("main-scroll-container") || document.body;
        let frame: number | null = null;

        const setHeadingState = (newHeadings: Heading[]) => {
            setHeadings((current) => {
                if (
                    current.length === newHeadings.length &&
                    current.every(
                        (heading, index) =>
                            heading.id === newHeadings[index]?.id &&
                            heading.text === newHeadings[index]?.text &&
                            heading.level === newHeadings[index]?.level,
                    )
                ) {
                    return current;
                }
                return newHeadings;
            });
        };

        const readHeadings = () => {
            const renderedHeadings = Array.from(
                document.querySelectorAll<HTMLHeadingElement>(
                    ".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6",
                ),
            );
            const elements =
                renderedHeadings.length > 0
                    ? renderedHeadings
                    : Array.from(container.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5, h6"));
            setHeadingState(
                elements.map((element, index) => ({
                    element,
                    text: element.textContent || "",
                    level: Number(element.tagName.replace("H", "")),
                    id: element.id || element.getAttribute("data-id") || `heading-${index}`,
                })),
            );
        };

        const updateHeadingText = () => {
            setHeadings((current) => {
                let changed = false;
                const updated = current.map((heading) => {
                    const text = heading.element.isConnected ? heading.element.textContent || "" : heading.text;
                    if (text !== heading.text) changed = true;
                    return text === heading.text ? heading : { ...heading, text };
                });
                return changed ? updated : current;
            });
        };

        const scheduleStructureUpdate = () => {
            if (frame !== null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                readHeadings();
            });
        };

        readHeadings();
        const observer = new MutationObserver(scheduleStructureUpdate);
        observer.observe(container, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["id", "data-id"],
        });
        container.addEventListener("input", updateHeadingText);
        return () => {
            observer.disconnect();
            container.removeEventListener("input", updateHeadingText);
            if (frame !== null) cancelAnimationFrame(frame);
        };
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
        <div ref={popoverRef} className="fixed top-20 right-5 z-50 print:hidden">
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? popoverId : undefined}
                aria-label="Open table of contents"
                onClick={() => setIsOpen((open) => !open)}
                className={css(
                    "rounded-button-radius flex size-11 items-center justify-center border transition-[background-color,border-color,color,transform] duration-200",
                    "border-card-border bg-card-background text-muted-foreground shadow-soft",
                    "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isOpen && "border-primary/35 bg-primary/10 text-primary",
                )}
            >
                <ListBulletsIcon size={21} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.dialog
                        open
                        id={popoverId}
                        aria-label="Table of contents"
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96, y: -8 }}
                        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: -8 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className={css(
                            "absolute top-full right-0 m-0 mt-3 flex max-h-96 w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card-radius",
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
                                className="rounded-button-radius flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                onClick={() => setIsOpen(false)}
                            >
                                <XIcon size={15} />
                            </button>
                        </div>
                        <ul className="custom-scrollbar flex flex-col gap-1 overflow-y-auto overscroll-contain p-2">
                            {headings.map((heading) => (
                                <motion.li
                                    key={heading.id}
                                    className="relative"
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: -4 }}
                                    style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const el =
                                                document.getElementById(heading.id) ||
                                                document.querySelector(`[data-id="${heading.id}"]`) ||
                                                (heading.element && heading.element.isConnected
                                                    ? heading.element
                                                    : null);
                                            if (el) {
                                                el.scrollIntoView({
                                                    behavior: shouldReduceMotion ? "auto" : "smooth",
                                                    block: "start",
                                                });
                                                setIsOpen(false);
                                            }
                                        }}
                                        className={css(
                                            "group rounded-button-radius flex min-h-9 w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                            "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                                            heading.level <= 2 && "font-medium text-foreground/85",
                                        )}
                                    >
                                        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/35 transition-colors group-hover:bg-primary" />
                                        <span className="line-clamp-2 min-w-0">{heading.text}</span>
                                    </button>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.dialog>
                )}
            </AnimatePresence>
        </div>
    );
};
