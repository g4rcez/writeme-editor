type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "ctrlKey" | "metaKey" | "shiftKey" | "key"
>;

export function isCommanderShortcut(event: KeyboardShortcutEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === "p"
  );
}
