export const HASHTAGS_CHANGED_EVENT = "writeme:hashtags-changed";

export function notifyHashtagsChanged(): void {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(HASHTAGS_CHANGED_EVENT));
}
