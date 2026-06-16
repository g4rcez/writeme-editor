type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "ctrlKey" | "metaKey" | "shiftKey" | "key"
>;

function hasPrimaryModifier(event: KeyboardShortcutEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

export function isCommanderShortcut(event: KeyboardShortcutEvent): boolean {
  return (
    hasPrimaryModifier(event) &&
    event.shiftKey &&
    event.key.toLowerCase() === "p"
  );
}

export function isNewAiChatShortcut(event: KeyboardShortcutEvent): boolean {
  return (
    hasPrimaryModifier(event) &&
    event.shiftKey &&
    event.key.toLowerCase() === "n"
  );
}

export function isNewNoteShortcut(event: KeyboardShortcutEvent): boolean {
  return (
    hasPrimaryModifier(event) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "n"
  );
}
