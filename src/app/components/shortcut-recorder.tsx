import { useEffect, useRef, useState } from "react";

const KEY_DISPLAY_MAP: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Escape",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

const MODIFIER_KEYS = new Set([
  "Meta",
  "Control",
  "Alt",
  "Shift",
  "OS",
  "Command",
]);

function buildAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const modifiers: string[] = [];
  if (e.metaKey && e.ctrlKey) {
    modifiers.push("CommandOrControl");
  } else if (e.metaKey) {
    modifiers.push("Command");
  } else if (e.ctrlKey) {
    modifiers.push("Control");
  }
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");

  if (modifiers.length === 0) return null;

  const key =
    KEY_DISPLAY_MAP[e.key] ??
    (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return [...modifiers, key].join("+");
}

function displayAccelerator(accelerator: string): string {
  const isMac = navigator.platform.startsWith("Mac");
  return accelerator
    .split("+")
    .map((part) => {
      switch (part) {
        case "CommandOrControl":
          return isMac ? "⌘" : "Ctrl";
        case "Command":
          return "⌘";
        case "Control":
          return "Ctrl";
        case "Alt":
          return isMac ? "⌥" : "Alt";
        case "Shift":
          return "⇧";
        default:
          return part;
      }
    })
    .join(isMac ? "" : "+");
}

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function ShortcutRecorder({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const accelerator = buildAccelerator(e);
      if (accelerator) {
        onChange(accelerator);
        setRecording(false);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  useEffect(() => {
    if (recording) buttonRef.current?.focus();
  }, [recording]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setRecording((v) => !v)}
      onBlur={() => setRecording(false)}
      className={[
        "min-w-[120px] rounded border px-3 py-2 text-sm font-mono transition-all",
        "border-border focus:outline-none",
        recording
          ? "ring-2 ring-primary border-primary text-muted-foreground"
          : "hover:border-primary/60",
      ].join(" ")}
    >
      {recording ? "Press shortcut…" : displayAccelerator(value)}
    </button>
  );
}
