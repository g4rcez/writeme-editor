import { useSyncExternalStore } from "react";
import { isMobile } from "@/lib/platform";

export const COMPACT_QUERY = "(max-width: 767px)";

const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {return () => undefined;}
    const mql = window.matchMedia(COMPACT_QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
};

const getSnapshot = (): boolean =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(COMPACT_QUERY).matches
        : false;

/** True while the viewport is narrower than the tablet breakpoint (767px), the same one the sidebar uses. */
export function useIsCompact(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * True only for the native/mobile build at phone width. Web, desktop and iPad-sized windows keep the
 * desktop layout; an iPad in a narrow Split View gets the phone shell.
 */
export function usePhoneShell(): boolean {
    const compact = useIsCompact();
    return isMobile() && compact;
}
