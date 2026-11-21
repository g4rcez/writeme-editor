type Navigate = {
    (delta: number): void;
    (to: string, options?: { replace?: boolean }): void;
};

/** React Router stores its position in the history stack as `history.state.idx`. */
export function canGoBack(): boolean {
    const idx = window.history.state?.idx;
    return typeof idx === "number" && idx > 0;
}

/** Pops the app history when there is an entry to return to, otherwise lands on `home`. */
export function goBackOrHome(navigate: Navigate, home = "/notes"): void {
    if (canGoBack()) navigate(-1);
    else navigate(home, { replace: true });
}
