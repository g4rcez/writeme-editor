import { css } from "@g4rcez/components";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

const CLICKABLE_SELECTOR = [
  "a",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[onclick]",
].join(",");
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_HINT_COUNT = LETTERS.length * LETTERS.length;
const HINT_EDGE_PADDING = 8;

export type ClickHint = {
  code: string;
  element: HTMLElement;
  left: number;
  top: number;
};

export function getClickHintCode(index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_HINT_COUNT) {
    return null;
  }

  return `${LETTERS.charAt(Math.floor(index / LETTERS.length))}${LETTERS.charAt(
    index % LETTERS.length,
  )}`;
}

function isDisabledControl(element: HTMLElement): boolean {
  return (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLOptionElement) &&
    element.disabled
  );
}

function isElementVisible(element: HTMLElement): boolean {
  if (element.closest("[data-click-hints-overlay]")) return false;
  if (element.closest("[hidden],[inert],[aria-hidden='true']")) return false;
  if (isDisabledControl(element)) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.pointerEvents === "none"
  ) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth
  );
}

export function getVisibleClickableElements(
  root: ParentNode = document,
): HTMLElement[] {
  return Array.from(root.querySelectorAll(CLICKABLE_SELECTOR)).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && isElementVisible(element),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getHintPosition(
  element: HTMLElement,
): Pick<ClickHint, "left" | "top"> {
  const rect = element.getBoundingClientRect();
  const left = clamp(
    rect.left + rect.width / 2,
    HINT_EDGE_PADDING,
    window.innerWidth - HINT_EDGE_PADDING,
  );
  const top = clamp(
    rect.top + Math.min(rect.height / 2, 16),
    HINT_EDGE_PADDING,
    window.innerHeight - HINT_EDGE_PADDING,
  );

  return { left, top };
}

export function createClickHints(elements: HTMLElement[]): ClickHint[] {
  const hints: ClickHint[] = [];
  for (const element of elements) {
    const code = getClickHintCode(hints.length);
    if (!code) break;
    hints.push({ code, element, ...getHintPosition(element) });
  }

  return hints;
}

function isClickHintsShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    (event.key === "/" || event.code === "Slash")
  );
}

function getLetterKey(event: KeyboardEvent): string | null {
  if (event.key.length !== 1) return null;
  const key = event.key.toUpperCase();
  return LETTERS.includes(key) ? key : null;
}

export function KeyboardClickHints(): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [hints, setHints] = useState<ClickHint[]>([]);

  const refreshHints = useCallback((): void => {
    setHints(createClickHints(getVisibleClickableElements()));
  }, []);

  const closeHints = useCallback((): void => {
    setIsOpen(false);
    setTypedCode("");
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setHints([]);
      return;
    }

    refreshHints();
  }, [isOpen, refreshHints]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    let frame = 0;
    const scheduleRefresh = (): void => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refreshHints);
    };

    window.addEventListener("resize", scheduleRefresh, {
      signal: controller.signal,
    });
    document.addEventListener("scroll", scheduleRefresh, {
      capture: true,
      signal: controller.signal,
    });
    document.addEventListener("pointerdown", closeHints, {
      capture: true,
      signal: controller.signal,
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [closeHints, isOpen, refreshHints]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isClickHintsShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        setTypedCode("");
        setIsOpen((current) => !current);
        return;
      }

      if (!isOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        closeHints();
        return;
      }

      if (event.key === "Backspace") {
        setTypedCode((current) => current.slice(0, -1));
        return;
      }

      if (event.key === "Enter") {
        if (typedCode.length !== 2) return;

        const hint = hints.find((current) => current.code === typedCode);
        if (!hint) {
          setTypedCode("");
          return;
        }

        closeHints();
        window.setTimeout(() => hint.element.click(), 0);
        return;
      }

      const letter = getLetterKey(event);
      if (!letter) return;

      setTypedCode((current) =>
        current.length >= 2 ? letter : `${current}${letter}`,
      );
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [closeHints, hints, isOpen, typedCode]);

  if (!isOpen) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[2147483647] print:hidden"
      data-click-hints-overlay
    >
      {hints.map((hint) => {
        const isMatchingPrefix =
          typedCode.length > 0 && hint.code.startsWith(typedCode);

        return (
          <span
            key={hint.code}
            style={{ left: hint.left, top: hint.top }}
            className={css(
              "fixed -translate-x-1/2 -translate-y-1/2 rounded-md font-mono text-xs ",
            )}
          >
            <span
              className={css(
                "py-1 px-1.5 bg-floating-background text-floating-foreground font-mono text-xs ring-border/40",
                "border border-floating-border rounded-lg",
                isMatchingPrefix && "border-primary ring-primary/60",
              )}
            >
              {hint.code}
            </span>
          </span>
        );
      })}
    </div>
  );
}
