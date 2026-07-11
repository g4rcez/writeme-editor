type KeyboardShortcutEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "key">;

export type TabNavigationShortcut = { type: "index"; index: number } | { type: "last" };

function hasPrimaryModifier(event: KeyboardShortcutEvent): boolean {
    return event.ctrlKey || event.metaKey;
}

export function isCommanderShortcut(event: KeyboardShortcutEvent): boolean {
    return hasPrimaryModifier(event) && event.shiftKey && event.key.toLowerCase() === "p";
}

export function isNewAiChatShortcut(event: KeyboardShortcutEvent): boolean {
    return hasPrimaryModifier(event) && event.shiftKey && event.key.toLowerCase() === "n";
}

export function isNewNoteShortcut(event: KeyboardShortcutEvent): boolean {
    return hasPrimaryModifier(event) && !event.shiftKey && event.key.toLowerCase() === "n";
}

export function getTabNavigationShortcut(event: KeyboardShortcutEvent): TabNavigationShortcut | null {
    if (!hasPrimaryModifier(event) || event.shiftKey || event.altKey) return null;

    const tabNumber = Number(event.key);
    if (!Number.isInteger(tabNumber) || tabNumber < 1 || tabNumber > 9) {
        return null;
    }

    if (tabNumber === 9) return { type: "last" };
    return { type: "index", index: tabNumber - 1 };
}
