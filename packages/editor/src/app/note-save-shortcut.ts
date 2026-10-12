export function registerNoteSaveShortcut(id: string, save: () => void, active?: boolean): () => void {
    const onKeyDown = (event: KeyboardEvent): void => {
        if (
            event.defaultPrevented ||
            event.isComposing ||
            !(event.ctrlKey || event.metaKey) ||
            event.altKey ||
            event.shiftKey ||
            event.key.toLowerCase() !== "s"
        )
            return;
        const container = document.getElementById(`editor-container-${id}`);
        if (!container) return;
        const focusedEditor = document.activeElement?.closest(".writeme-editor");
        if (
            focusedEditor
                ? focusedEditor !== container
                : !(active ?? document.querySelectorAll(".writeme-editor").length === 1)
        )
            return;
        event.preventDefault();
        if (!event.repeat) save();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
}
